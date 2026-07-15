# packages/server

Shared library used by all servers in this monorepo. Built with rslib, tested with rstest.

## Architecture

### ServerApp — fluent builder, owns the awilix DI container

`ServerApp.init()` takes an **array of drivers**, not a single one — each driver runs its own
protocol (gRPC, GraphQL, Kafka consumer, ...) but they all share one awilix container, one set of
routers/interceptors/plugins, and one lifecycle:

```ts
import { ApolloDriver, GrpcDriver, KafkaDriver, ServerApp, singleton, VaultPgAdapter } from 'server';

ServerApp.init([
  {
    driver: GrpcDriver,
    port: 5001,
    onReady: ({ port, host }) => console.log(`gRPC on ${host}:${port}`),
  },
  {
    driver: ApolloDriver,
    port: 4001,
    onReady: ({ port, host }) => console.log(`GraphQL on ${host}:${port}`),
  },
  KafkaDriver, // bare constructor — no port needed, e.g. a Kafka consumer
])
  .database(PrismaClient, () => VaultPgAdapter.fromEnv())  // async factory — see Database section below; sync new PgAdapter(...) also accepted
  .containers({                   // register repositories — no awilix import needed in servers
    demoRepository: singleton(DemoRepository),
  })
  .routers([DemoGrpcRouter, DemoGraphqlRouter])
  .interceptors([AuthInterceptor])
  .host('0.0.0.0')                // fallback host for entries that don't set their own
  .run(({ driver, port, host }) => console.log(`${driver} ready on ${host}:${port}`))
```

`ServerApp.init()` also accepts a single bare driver constructor (`ServerApp.init(GrpcDriver)`),
in which case `.port()`/`.host()` configure it directly — useful when a server only runs one driver.

- A driver entry is either a bare `Constructor<BaseDriver>` (falls back to `.host()`/`.port()`
  defaults — useful for drivers like a Kafka consumer that don't bind a port) or
  `{ driver, port?, host?, onReady?, config? }` to override per-driver.
- `config` is passed as the driver's sole constructor argument (`new Driver(config)`) — lets a
  driver take rich typed config (e.g. `KafkaDriver`'s `{ brokers, clientId, groupId, topics }`)
  instead of being limited to env vars. Drivers that don't use it are unaffected: `undefined` still
  triggers their own constructor's default parameters, same as `new Driver()`.
- `DriverStartOptions` (what every driver's `start()` receives) includes `container: AwilixContainer`
  — the same container `.containers()`/routers use — so a driver can register things like a shared
  Kafka client into it (`container.register({ kafkaProducer: asValue(producer) })`), letting
  repositories/use cases inject it from the cradle the same way they'd inject a repository.
- `onReady` fires for that driver only, once its `start()` resolves — prefer it over string-matching
  `info.driver` inside the shared `run()` callback when different drivers need different startup
  behavior (e.g. different log lines, or driver-specific side effects like health-check registration).
  `run()`'s callback still fires for **every** driver afterwards, as a catch-all — both can be used
  together.
- One `ServerApp` = one awilix container, shared by **all** its drivers/routers — this is the main
  reason to list multiple drivers on one `ServerApp` instead of creating separate `ServerApp`
  instances (which each get an isolated container; see "Multi-protocol servers" below).
- `container` and `prisma` are registered automatically. Routers receive the container via constructor.
- Plugin instances created in `run()` are retained and reused in `stop()` — not re-instantiated.
- Each driver only acts on the routers it recognizes (e.g. `ApolloDriver` skips non-GraphQL
  routers via duck-typing) — so passing a mixed `routers` array to multiple drivers is expected
  and safe.

### Drivers

| Class | Protocol | Key dep |
|---|---|---|
| `GrpcDriver` | gRPC | `@grpc/grpc-js` |
| `ApolloDriver` | GraphQL | `@apollo/server` |
| `CronDriver` | Scheduled jobs | `Bun.cron` (built-in, no dep) |

Both accept injectable server/factory params in their constructor for testability (avoids module mocking in tests).

### Routers

**GrpcRouter** — generic over the ts-proto generated `*Server` interface (NOT the `*Service` const):

```ts
// CORRECT
class DemoRouter extends GrpcRouter<DemoServiceServer> { ... }

// WRONG — DemoServiceService has serializers, not handleUnaryCall, so types resolve to never
class DemoRouter extends GrpcRouter<DemoServiceService> { ... }
```

`get service()` returns the `*Service` const. `get handlers()` returns `GrpcHandlerMap<TService>`.

`GrpcHandlerMap<TService>` unwraps `handleUnaryCall<Req, Res>` via type inference:
```ts
type ExtractReq<T> = T extends handleUnaryCall<infer Req, any> ? Req : never;
type ExtractRes<T> = T extends handleUnaryCall<any, infer Res> ? Res : never;
```

So if the proto has `testDemo: handleUnaryCall<Empty, Demo1>`, the handler must be `BaseUseCase<Empty, Demo1>`.

**GraphqlRouter** — handlers are grouped by GraphQL type name:

```ts
class DemoGraphqlRouter extends GraphqlRouter {
  get typeDefs() { return `type Query { hello: String }` }
  get handlers(): GraphqlHandlerMap {
    return { Query: { hello: HelloUseCase } }
  }
}
```

`get resolvers()` is computed — ApolloDriver reads it directly. `register()` is a no-op.

Both routers **auto-register use cases into the container** (via `asClass().transient()`) when `register()` / `resolvers` is first called. Token name = `lcFirst(ClassName)` e.g. `TestDemoUseCase` → `testDemoUseCase`. Skips if already registered.

### Use Cases

```ts
class TestDemoUseCase extends BaseUseCase<Empty, Demo1> {
  async execute(input: Empty): Promise<Demo1> { ... }
}
```

One class, one method, one business operation. Resolved transiently from container per request.

### ProcessOrchestrator — orchestrated SAGA

`ProcessOrchestrator<TContext>` is itself a `BaseUseCase<TContext, TContext>` — it slots straight
into any `GrpcHandlerMap`/`GraphqlHandlerMap` like a normal use case, no router changes needed. A
concrete saga overrides `build()` to register steps in order via `this.step(main, fallback,
options?)`; each step's `main` use case receives the accumulated context and returns a
`Partial<TContext>` patch merged into it before the next step runs.

```ts
interface RegisterUserContext {
  email: string;
  password: string;
  name: string;
  userId?: string;
  emailSent?: boolean;
}

class CreateUserUseCase extends BaseUseCase<RegisterUserContext, Partial<RegisterUserContext>> {
  constructor(private readonly userRepository: UserRepository) { super(); }
  async execute({ email, password, name }: RegisterUserContext) {
    const user = await this.userRepository.create({ email, password, name });
    return { userId: user.id };
  }
}

class DeleteUserUseCase extends BaseUseCase<RegisterUserContext, void> {
  constructor(private readonly userRepository: UserRepository) { super(); }
  async execute({ userId }: RegisterUserContext) {
    if (userId) await this.userRepository.delete(userId);
  }
}

class SendWelcomeEmailUseCase extends BaseUseCase<RegisterUserContext, Partial<RegisterUserContext>> {
  constructor(private readonly emailService: EmailService) { super(); }
  async execute({ email, name }: RegisterUserContext) {
    await this.emailService.sendWelcome(email, name);
    return { emailSent: true };
  }
}

// no later step to fail after this one, but `.step()` still requires a fallback — reuse a no-op
class NoopUseCase extends BaseUseCase<unknown, void> {
  async execute() {}
}

class RegisterUserSaga extends ProcessOrchestrator<RegisterUserContext> {
  protected build() {
    this.step(CreateUserUseCase, DeleteUserUseCase).step(
      SendWelcomeEmailUseCase,
      NoopUseCase,
      { retries: 2, retryDelayMs: 500, timeoutMs: 5000 }, // email send: retry twice, 5s/attempt
    );
  }
}

class AuthGraphqlRouter extends GraphqlRouter {
  get typeDefs() {
    return `type Mutation { registerUser(email: String!, password: String!, name: String!): User! }`;
  }
  get handlers(): GraphqlHandlerMap {
    return { Mutation: { registerUser: RegisterUserSaga } };
  }
}
```

- **Constructor takes `{ container }`, same awilix PROXY convention as any use case** —
  `container` is already registered (`asValue`) by `ServerApp`, so a saga is resolved by the
  router exactly like any other handler; nothing extra needs registering.
- **Compensation on failure**: if a step's `main` use case fails (after exhausting retries), the
  `fallback` of every already-*completed* step runs, in reverse order, then the original error is
  rethrown. The failing step's own fallback never runs — it never committed, so it has nothing to
  undo.
- **`options?: { retries?, retryDelayMs?, timeoutMs? }`** (all default off): each attempt races
  against `timeoutMs` (rejecting with `StepTimeoutError` if it fires first); failed attempts
  retry up to `retries` more times, waiting `retryDelayMs` between them. Only exhausting every
  attempt counts as the step failing. A retried step is re-resolved from the container each
  attempt (fresh transient instance), same as any other use case resolution.
- **Fallbacks are not retried or timeout-guarded** — if a compensation itself throws, it
  propagates immediately and stops further compensations from running. Apply the same `options` to
  a step's own compensating use case by wrapping it, if a saga needs that.
- Every `main`/`fallback` use case is auto-registered into the container transiently on first
  resolution — same `lcFirst(ClassName)` token convention as routers.

### Repositories

```ts
class UserRepository extends BaseRepository<PrismaClient> {
  // awilix PROXY mode: constructor destructures from cradle
  constructor({ prisma }: { prisma: PrismaClient }) {
    super({ prisma });
  }
  findById(id: string) { return this.prisma.user.findUnique({ where: { id } }) }
}
```

Only repositories declare `prisma` as a constructor dependency — enforced by convention. Use cases and routers never receive it.

### Database — DbAdapter + PgAdapter

Prisma 7 uses a rust-free "client" engine that **requires a driver adapter**.

`ServerApp.database(ClientClass, dbAdapter)` accepts the Prisma client class and either a `DbAdapter`
instance **or** an async factory (`() => Promise<DbAdapter>`) — the factory form exists specifically
for `VaultPgAdapter.fromEnv()` below, which needs an awaited Vault round-trip before a `DbAdapter`
exists at all. Internally:
- The adapter is resolved (awaited, if a factory) as the very first step of `run()` — before
  `$connect()`, before any plugin's `onStart()`, before any driver starts — since `ClientClass`
  itself can't be instantiated until a real adapter exists.
- `new ClientClass({ adapter: dbAdapter.adapter })` is then registered as `prisma` (singleton) in
  the container.
- `run()` calls `$connect()`, `stop()` calls `$disconnect()` then `dbAdapter.end()`.

`PgAdapter` is provided by server (PostgreSQL). To add another database in future, create a class implementing `DbAdapter`:
```ts
export interface DbAdapter {
  readonly adapter: unknown;
  end(): Promise<void>;
}
```

```ts
import { PgAdapter } from 'server';
.database(PrismaClient, new PgAdapter(process.env.DATABASE_URL))
// PgAdapter accepts a connection string or pg PoolConfig object — this is also the "switch to
// root for testing" path: manually swap the generated VaultPgAdapter.fromEnv() call below for
// new PgAdapter(process.env.DATABASE_URL!) to bypass Vault entirely with the server's static
// superuser credential (DATABASE_URL is already present in every server's .env — see below).
```

### Vault-backed credentials — VaultPgAdapter

Every server generated via `turbo gen`'s `database` extension defaults to a Vault-issued,
short-lived Postgres credential instead of a static one:

```ts
import { VaultPgAdapter, ServerApp } from 'server';

ServerApp.init([...])
  .database(PrismaClient, () => VaultPgAdapter.fromEnv())
  .run();
```

- `VaultPgAdapter.fromEnv()` (async — this is the reason `.database()` accepts a factory, not just
  a value) logs into Vault via AppRole (`VAULT_ROLE_ID`/`VAULT_SECRET_ID` env vars), then reads
  `database/creds/<VAULT_DB_ROLE>` to get a freshly-generated `username`/`password`, and builds a
  `PgAdapter` from `postgresql://<username>:<password>@<DB_HOST>:<DB_PORT>/<DB_NAME>`. Plain
  `fetch` against Vault's HTTP API — no `node-vault` dependency, same thin-client convention as
  `MeilisearchPlugin`.
- Env vars: `VAULT_ADDR` (default `http://localhost:8200`), `VAULT_ROLE_ID`, `VAULT_SECRET_ID`,
  `VAULT_DB_ROLE` (e.g. `test1-role`), `DB_HOST`/`DB_PORT`/`DB_NAME` — Vault only returns a
  username/password, not a full connection string, so these are needed to assemble one. All
  optionally overridable via `VaultPgAdapter.fromEnv({ vaultAddr, roleId, secretId, dbRole, dbHost, dbPort, dbName })`.
  `DATABASE_URL` also still exists alongside these (same static superuser) — `prisma.config.ts`
  (`createPrismaConfig()`) reads it directly for Prisma CLI operations (`generate`/`migrate`),
  which need a static connection regardless of Vault; `VaultPgAdapter` never reads it.
- **Where `VAULT_ROLE_ID`/`VAULT_SECRET_ID` actually come from**: Vault dev mode starts with no
  database secrets engine, no AppRole auth, no roles at all — see `services/vault/ansible/`, a
  role-based Ansible playbook (`community.hashi_vault` collection) that provisions all of this per
  server and writes the resulting AppRole credentials into that server's `.env`/`.env.sample`.
  Run via `bun run vault:provision` inside the server's own directory. **Must be re-run any time
  Vault itself restarts** — dev mode forgets everything, see `services/vault/CLAUDE.md`.
- **No lease renewal.** The dynamic credential expires at its Vault lease TTL (`default_ttl: 1h`,
  set in the Ansible role's `database/roles/<name>-role`) — nothing in this integration renews it.
  A long-running server will start failing new Postgres connections once the lease expires; the
  fix is restarting the server (which calls `VaultPgAdapter.fromEnv()` again and gets a fresh
  lease), not a background refresh. Accepted as a known gap for this prototype's scope — see
  `services/vault/CLAUDE.md`.
- **The "root" testing override** (`new PgAdapter(process.env.DATABASE_URL!)` above) uses the
  exact same Postgres superuser Vault itself uses as its DB-admin connection
  (`database/config/<name>-db`) — there's deliberately no separate Vault-only admin identity, see
  `services/vault/CLAUDE.md`.

Each server has its own Prisma schema, config, and generated client:
- Schema: `servers/<name>/src/schemas/prisma/schema.prisma`
- Config: `servers/<name>/prisma.config.ts` using `defineConfig` (Prisma 7 — replaces `package.json` `prisma` field)
- Migrations: `servers/<name>/src/schemas/prisma/migrations/`
- Generated client output: `src/generated/prisma` (gitignored, regenerated via `postinstall`)
- `.env` at server root — Bun loads it automatically, no dotenv needed

### Registering dependencies

Repositories must be registered via `.containers()` using helpers from server — no awilix import needed in servers:

```ts
import { singleton, transient } from 'server';

.containers({
  userRepository: singleton(UserRepository),   // one instance per container
  someHelper: transient(SomeHelper),           // new instance per resolution
})
```

Use cases are auto-registered by the router (always transient, token = `lcFirst(ClassName)`).

### Interceptors vs Plugins

| | `BaseInterceptor` | `BasePlugin` |
|---|---|---|
| Scope | Request-level | Server-level |
| Hook | `apply(server)` | `onStart()` / `onStop()` |
| Examples | Auth, logging, OTel | Redis, Meilisearch |

Plugins are constructed by `ServerApp` as `new Plugin(container)` — the container is passed
directly (not awilix PROXY mode, since plugins aren't resolved from the container). A plugin's
`onStart()` typically registers infra clients into the container via `asValue()` so
repositories/use cases can inject them from the cradle. `RedisPlugin` (`server`'s own implementation)
is the concrete example:

```ts
import { RedisPlugin, ServerApp } from 'server';

ServerApp.init([...])
  .plugins([RedisPlugin])
  .routers([...])
  .run();

// elsewhere, e.g. a repository:
constructor({ redis }: { redis: RedisClient }) { ... }  // awilix PROXY, token = 'redis'
```

- Uses **Bun's built-in `RedisClient`** (`import { RedisClient } from 'bun'`), not an npm client —
  no dependency to add. `new RedisClient()` (no args) resolves its connection from
  `REDIS_URL`/`VALKEY_URL` env vars itself, falling back to `valkey://localhost:6379` — the plugin
  doesn't parse or default any of that itself. Verified this is really Bun's own behavior (not
  something the plugin needs to wire up) by calling `new RedisClient()` directly with only
  `REDIS_URL` set in the environment — it connects with no other args.
- Connects eagerly in `onStart()` (explicit `.connect()`) so a bad connection fails server startup
  instead of surfacing later on first command — same rationale as `database()` calling `$connect()`
  up front.
- `ServerApp.plugins()` takes bare constructors, not `{ plugin, config }` entries like
  `DriverEntry`, so there's no per-plugin config passthrough today — configure via env vars only.
- **`'bun'` is only resolvable under the Bun runtime** — rstest's test runner executes test files
  under Node, where the `bun` builtin module doesn't exist, and rslib's Rspack-based bundler can't
  resolve it either at build time. So `RedisPlugin.ts` only has a **type-only** top-level import
  (`import type { RedisClient } from 'bun'`); the real class is loaded lazily via
  `await import('bun')` inside the default `createClient` factory, which only runs if nothing else
  is injected in its place — tests always inject their own mock factory, so the dynamic import
  never executes under rstest. `rslib.config.ts`'s `output.externals: { bun: 'module bun' }` is the
  other half of this: without it, the production build fails with "Module not found: Can't resolve
  'bun'" even though the dynamic import is never evaluated at build time — Rspack still needs to be
  told not to try bundling it.
- Takes that same `createClient: () => Promise<RedisClient>` factory as an injectable constructor
  param, same testability pattern as the drivers (avoids touching the real Bun Redis client in
  tests) — just async, since the default implementation's `import('bun')` is itself a promise.

`MeilisearchPlugin` follows the exact same shape (`extends BasePlugin`, constructed as
`new Plugin(container)`, `onStart()` registers the client via `asValue()`), with one difference
from `RedisPlugin`:

```ts
import { MeilisearchPlugin, ServerApp } from 'server';

ServerApp.init([...])
  .plugins([MeilisearchPlugin])
  .routers([...])
  .run();

// elsewhere, e.g. a repository:
constructor({ meilisearch }: { meilisearch: MeiliSearch }) { ... }  // awilix PROXY, token = 'meilisearch'
```

- Uses the official **`meilisearch` npm package** (`import { MeiliSearch } from 'meilisearch'`),
  not a Bun builtin — it's a regular isomorphic (fetch-based) client with no native bindings, so
  unlike `RedisPlugin` it's a plain **top-level static import**, no dynamic `await import('bun')`
  trick and no `rslib.config.ts` `externals` entry needed. It resolves normally under both the
  Bun runtime and rstest's Node-based test runner, and bundles fine through rslib.
  `MEILISEARCH_HOST` (default `http://localhost:7700`) / `MEILISEARCH_API_KEY` env vars configure
  the default client — same "configure via env vars only" constraint as `RedisPlugin`, since
  `ServerApp.plugins()` only takes bare constructors, never `{ plugin, config }` entries.
- Auth is a **master key sent as an `Authorization: Bearer <key>` header** (handled internally by
  the client's `apiKey` option), not embedded in the host URL the way Redis's connection string
  carries its password — see `services/meilisearch/CLAUDE.md`.
- `onStart()` calls `await this.client.health()` eagerly — throws on a bad host/key, failing
  server startup instead of surfacing later on first search request, same rationale as
  `RedisPlugin`'s eager `.connect()` and `database()`'s eager `$connect()`.
- `onStop()` is a no-op — Meilisearch's client is stateless HTTP (no persistent connection to
  close), unlike `RedisPlugin.onStop()`'s `client.close()`.
- Takes the same injectable `createClient: () => MeiliSearch` factory constructor param as
  `RedisPlugin`'s `createClient` (just synchronous, since constructing a `MeiliSearch` instance
  doesn't need an awaited dynamic import) — same testability pattern, tests inject their own mock.

`OtelPlugin` sets up OpenTelemetry (traces + metrics, exported via OTLP/gRPC to a Collector — no
`services/*` counterpart exists yet, this only wires up the server-side SDK) and instruments
exactly this framework's own protocol surface — gRPC, GraphQL, Kafka:

```ts
import { OtelPlugin, ServerApp } from 'server';

ServerApp.init([...])
  .plugins([OtelPlugin])
  .routers([...])
  .run();

// elsewhere, e.g. a use case that wants a custom span/counter:
constructor({ otelTracer, otelMeter }: { otelTracer: Tracer; otelMeter: Meter }) { ... }
```

- Configured via env vars only, same constraint as every other plugin: `OTEL_SERVICE_NAME`
  (default `unknown-service`), `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4317`).
  `OtelPluginConfig` also accepts `metricExportIntervalMillis` and a custom `instrumentations`
  array, but only when instantiated directly (bypassing `ServerApp.plugins()`) or in tests — not
  reachable through `.plugins([OtelPlugin])`, same as `RedisPlugin`/`MeilisearchPlugin`.
- Default instrumentations are `GrpcInstrumentation`, `GraphQLInstrumentation`,
  `KafkaJsInstrumentation` — deliberately not the much larger
  `@opentelemetry/auto-instrumentations-node` bundle, which instruments every Node core
  module/HTTP client this framework doesn't touch directly.
- **All `@opentelemetry/*` imports are dynamic (`await import(...)` inside the default factory),
  not static top-level imports** — only type-only imports appear at module scope. Reason: some of
  these packages (`@opentelemetry/api` in particular) publish a custom `"module"` exports
  condition pointing at an ESM build with extensionless relative imports (e.g. `./baggage/utils`,
  no `.js`) — Rspack's own bundler-time resolver tolerates this fine (confirmed: the production
  build bundles them cleanly), but rstest's Node-based test runner resolves it via the runtime's
  strict ESM resolver and throws `Cannot find module`. Same pattern/rationale as `RedisPlugin`'s
  lazy `await import('bun')`: loading `OtelPlugin.ts` itself never touches the real packages, and
  the real dynamic import only runs inside the default factory — tests always inject their own
  mock factory (`createOtel`) in its place, so it never executes under rstest.
- `onStart()` calls `NodeSDK#start()`, which is synchronous and only registers providers with the
  OTel API — unlike `RedisPlugin`'s eager `.connect()`/`MeilisearchPlugin`'s eager `.health()`, it
  does **not** eagerly verify the collector endpoint, so a bad `OTEL_EXPORTER_OTLP_ENDPOINT`
  doesn't fail server startup — it fails silently on the first periodic export attempt instead.
- Registers `otelTracer`/`otelMeter` (`asValue`, from `trace.getTracer()`/`metrics.getMeter()`)
  into the container so any repository/use case can inject them from the cradle, same as
  `redis`/`meilisearch`.
- `onStop()` calls `NodeSDK#shutdown()`, flushing any buffered spans/metrics before the process exits.

Kafka is **not** modeled as a plugin — see `KafkaDriver` below. It needs producer/consumer/admin
lifecycle tied to the same driver-level config (`config` on a `DriverEntry`), and no separate
plugin instance to duck-type through `DriverStartOptions.plugins`.

Interceptors are constructed the same way plugins are — `new I(container)`. Unlike plugins,
**all the per-protocol wiring lives on `BaseInterceptor` itself** (Template Method) — a concrete
interceptor only implements one hook:

```ts
protected abstract intercept(request: InterceptorRequest): void | Promise<void>;
```

`intercept()` runs once per request — a protocol-agnostic `{ getHeader(name) }` view of the
incoming call/request, regardless of whether this ends up wired to gRPC or GraphQL. Throw an
`InterceptorError` to reject the call; return normally (or resolve) to let it continue — nothing
about the hook is auth-specific, so a logging/OTel interceptor would just read a header and never
throw. `AuthInterceptor` is the concrete example:

```ts
import { AuthInterceptor, ServerApp } from 'server';

ServerApp.init([...])
  .interceptors([AuthInterceptor])
  .routers([...])
  .run();
```

```ts
// AuthInterceptor's entire implementation, once BaseInterceptor owns the plumbing:
export class AuthInterceptor extends BaseInterceptor {
  protected validateToken(token?: string): boolean | Promise<boolean> {
    if (!token) return false;
    const bearerToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    return bearerToken === process.env.AUTH_TOKEN;
  }

  protected async intercept(request: InterceptorRequest): Promise<void> {
    if (!(await this.validateToken(request.getHeader('authorization')))) {
      throw new InterceptorError('Unauthenticated');
    }
  }
}
```

- **No constructor at all** — both customization points (`intercept()` and `validateToken()`) are
  overridable protected methods, not constructor-injected functions, so every interceptor (base or
  derived) follows the exact same "subclass and override a method" story with no second pattern to
  learn. `ServerApp.interceptors()` only ever takes bare constructors
  (`Constructor<BaseInterceptor>[]`), never pre-built instances, so constructor injection wouldn't
  have been reachable through the framework anyway (same reasoning that removed the earlier unused
  `container` param). Interceptors are still constructed as `new I(container)` (see `ServerApp.run()`)
  even though `AuthInterceptor` itself ignores that argument — a subclass needing real setup (like
  `AuthentikAuthInterceptor` below) takes it as an unused first param purely to occupy that position.
- `validateToken()`'s return type is `boolean | Promise<boolean>`, not just `boolean` — specifically
  so a subclass validating against a real network call can be `async`. `AuthInterceptor`'s own
  default just compares the incoming token against a static `AUTH_TOKEN` env var (stripping an
  optional `Bearer ` prefix) — a placeholder. `AuthentikAuthInterceptor`
  (`packages/server/src/interceptor/AuthentikAuthInterceptor.ts`) is the real validator this
  placeholder pointed at: verifies a Bearer token's signature against `servers/auth`'s
  Authentik-issued JWKS (`jose`'s `createRemoteJWKSet`/`jwtVerify`), checking `iss` (derived from
  `AUTHENTIK_URL` + `AUTHENTIK_APPLICATION_SLUG`, default `auth`) and optionally `aud` (only if
  `AUTHENTIK_JWT_AUDIENCE` is set — unset by default, since this repo's provisioning issues tokens
  from a single OAuth2 client and every consumer would otherwise need to know that client_id just to
  check `aud`). No shared secret to distribute: `services/authentik/ansible`'s provisioning role sets
  the OAuth2 Provider's `signing_key` to Authentik's own default self-signed `CertificateKeyPair`
  (RS256), so any server can fetch the public JWKS and verify independently — see
  `servers/auth/CLAUDE.md` for why this replaced the HS256 default (which would've required every
  consumer to hold `servers/auth`'s OAuth2 client_secret). Not yet wired into any server's
  `.interceptors([...])` by default — a server opts in explicitly, same as `AuthInterceptor` itself.
  See `CustomAuthInterceptor` in `AuthInterceptor.test.ts` for the general subclassing pattern this
  follows.
- **`apply(server)` (concrete on `BaseInterceptor`, not overridden by subclasses) duck-types the
  raw server it's given** via `protected isGrpcServer(server)`/`isApolloServer(server)` (same
  technique as `ApolloDriver`'s `isGraphqlRouter`/`KafkaDriver`'s `isKafkaConsumerRouter`), then
  wires up whichever protocol's *own* extension point applies — there's no shared "middleware"
  abstraction across gRPC and GraphQL to build one shared mechanism on top of instead:
  - **gRPC**: `@grpc/grpc-js` only supports server interceptors via `new Server({ interceptors })`
    at construction time — but `GrpcDriver` already constructs its `Server` before `apply()` runs,
    so there's no supported post-construction hook. `BaseInterceptor` instead wraps the public
    `addService()` method itself: every router's later `register()` call (which calls
    `addService()`) transparently goes through a wrapped implementation that awaits `intercept()`
    with `call.metadata.get(name)` as `getHeader`, before delegating to the real handler. On a
    thrown `InterceptorError` it calls back with `status.UNAUTHENTICATED` (16); any other thrown
    error still rejects the call, but as `status.INTERNAL` (13) instead, so a bug inside
    `intercept()` doesn't look identical to a deliberate rejection. Only wraps handlers with 2
    declared params (`(call, callback)` — unary/client-streaming); `GrpcRouter`, this framework's
    only producer of gRPC handlers, only ever builds `handleUnaryCall` today, so a 1-arg streaming
    handler is passed through unwrapped rather than guessing at how to reject a stream.
  - **GraphQL**: `ApolloServer.addPlugin()` is a stable, public extension point — no monkey-patching
    needed. Registers a plugin whose `didResolveOperation` hook (runs after parsing/validation, but
    before any resolver executes) awaits `intercept()` with `requestContext.request.http?.headers`
    as `getHeader`; a thrown `InterceptorError` is re-thrown as a `GraphQLError` with
    `extensions.code: 'UNAUTHENTICATED'` (Apollo's own convention), any other error propagates as-is
    (Apollo formats/logs it normally).
- Multiple interceptors compose fine even though gRPC wiring monkey-patches `addService` — each
  wraps whatever `addService` currently is (already-wrapped or original) at the time its own
  `apply()` runs, same as Express-style middleware chaining.

`BaseInterceptor`, `InterceptorRequest`, and `InterceptorError` are all exported from `server`'s
top-level barrel specifically so a consuming server doesn't have to add its interceptor to the
`server` package at all —
`intercept()` isn't auth-specific, so a server can write its own (logging, OTel, rate-limiting,
whatever it needs) locally and wire it in with `.interceptors([...])` alongside `AuthInterceptor`.
`servers/demo1/src/interceptors/LoggingInterceptor.ts` is the concrete example of this — see
`servers/demo1/CLAUDE.md`'s Custom interceptors section. Composes with `AuthInterceptor` for free —
both just implement `intercept()`, and `apply()`'s `addService`-wrapping chains regardless of order
or which package an interceptor was defined in.

### KafkaConsumerRouter + KafkaDriver

One `KafkaDriver` owns the entire Kafka relationship for a server — producer, consumer (if the
server has any `KafkaConsumerRouter`s), and topic provisioning — configured directly via a
`DriverEntry`'s `config`, the same way `GrpcDriver`/`ApolloDriver` take `port`/`host`.

```ts
import { demo1EventsTopics } from 'api'; // shared topic declaration — see "Kafka serialization" below
import { KafkaConsumerRouter, type KafkaHandlerMap } from 'server';
import LogDemo1EventUseCase from '../usecases/LogDemo1EventUseCase';

export class DemoKafkaRouter extends KafkaConsumerRouter<typeof demo1EventsTopics> {
  get topicTypes() { return demo1EventsTopics; }
  get handlers(): KafkaHandlerMap<typeof demo1EventsTopics> {
    return { 'demo1.events': LogDemo1EventUseCase };
  }
}
```

Consumer server (has a `KafkaConsumerRouter` — e.g. `demo2`):

```ts
import { ApolloDriver, GrpcDriver, KafkaDriver, ServerApp } from 'server';

ServerApp.init([
  { driver: GrpcDriver, port: 5002 },
  { driver: ApolloDriver, port: 4002 },
  { driver: KafkaDriver, onReady: () => console.log('Kafka consumer is running') },
])
  .routers([DemoGrpcRouter, DemoGraphqlRouter, DemoKafkaRouter])
  .run();
```

Producer-only server (no `KafkaConsumerRouter` — e.g. `demo1` — declare topics via `config.topics`
instead, so they're provisioned up front rather than racing the broker's auto-create):

```ts
{
  driver: KafkaDriver,
  config: {
    topics: demo1EventsTopics, // same import DemoKafkaRouter uses above — see "Kafka serialization" below
    serializer: new SchemaRegistryKafkaSerializer({ schemas: demo1EventsSchemas }),
  },
  onReady: () => console.log('Kafka producer is running'),
}
```

- `KafkaDriverConfig` (the `config` on a `DriverEntry`): `brokers?`, `clientId?`, `groupId?` (each
  falls back to `KAFKA_BROKERS`/`KAFKA_CLIENT_ID`/`KAFKA_GROUP_ID` env vars, then a hardcoded
  default), `topics?: Record<string, KafkaMessageType<any>>` — topics to provision that no router
  already declares (the producer side's equivalent of a router's `topicTypes` getter) — and
  `serializer?: KafkaSerializer` (see "Kafka serialization" below). `serializer` is typed optional
  on `KafkaDriverConfig` (a produce-only server with no `KafkaConsumerRouter` and only
  pre-encoded payloads genuinely doesn't need one), but every `KafkaConsumerRouter` unconditionally
  requires one to be configured somewhere in the server's drivers — see below.
- `start()` always connects a producer and registers `kafka` (raw client) + a wrapped
  `kafkaProducer: KafkaProducer` (`{ send(topic, value): Promise<void> }`, not the raw kafkajs
  `Producer`) into `DriverStartOptions.container`, so any repository/use case can inject
  `kafkaProducer` from the cradle exactly like injecting a repository. It only creates/subscribes a
  consumer if at least one `KafkaConsumerRouter` was passed to `.routers()` — a produce-only server
  never joins a consumer group.

#### Kafka serialization

Kafka messaging in this framework is **protobuf + Schema Registry by convention, not a per-topic
choice** — `KafkaConsumerRouter` decodes every topic through a container-resolved `KafkaSerializer`
automatically; there's no abstract `topics` getter to override with custom decode logic per
router. `KafkaSerializer` is **one strategy shared by both directions of a topic** — a producer's
`KafkaDriverConfig.serializer` (`serialize(topic, value)`, called from `kafkaProducer.send()`) and
every consumer router's decode (`deserialize(topic, payload)`, called from the base class's
concrete `topics` getter) — rather than two unrelated types for the two sides of what's
conceptually one decision ("how does this topic's bytes get encoded"). With no `serializer`
configured, `kafkaProducer.send()` requires `value` to already be an encoded
`Buffer`/`Uint8Array`/`string` and throws otherwise — it never silently stringifies an arbitrary
object, so a misconfigured producer fails at the call site instead of publishing garbage bytes.

```ts
export interface KafkaSerializer {
  serialize(topic: string, value: unknown): Promise<Buffer | Uint8Array>;
  deserialize<T>(topic: string, payload: Uint8Array): Promise<T>;
}
```

`SchemaRegistryKafkaSerializer` is `server`'s own concrete implementation, generalizing what used to
be inlined per-use-case (producer) and per-router (consumer) Confluent Schema Registry glue —
`SchemaRegistryClient` + `ProtobufSerializer` + `ProtobufDeserializer` — into one class backed by a
single shared client, instead of standing up a separate client per direction (or, on the consumer
side, per topic):

```ts
constructor({ kafkaProducer }: { kafkaProducer: KafkaProducer }) { ... }

async execute(...) {
  await this.kafkaProducer.send('demo1.events', { id: result.id, name: result.name });
}
```

```ts
// src/app.ts — configured once, KafkaDriver registers it into the container as kafkaSerializer
{
  driver: KafkaDriver,
  config: { serializer: new SchemaRegistryKafkaSerializer() }, // decode-only — no schemas needed
}
```

```ts
// src/routers/DemoKafkaRouter.ts — declares which topics it consumes; decode is fully automatic
const topicTypes = { 'demo1.events': Demo1Demo1eventProto.Demo1Event }; // same shape as config.topics

class DemoKafkaRouter extends KafkaConsumerRouter<typeof topicTypes> {
  get topicTypes() { return topicTypes; }
  get handlers(): KafkaHandlerMap<typeof topicTypes> {
    return { 'demo1.events': LogDemo1EventUseCase };
  }
}
```

- `serialize()` needs a **protobuf-es** (`@bufbuild/protobuf`) generated schema per topic, passed
  via `SchemaRegistryKafkaSerializerConfig.schemas` (e.g. `Demo1ProtobufEs.Demo1Schema`, generated
  into `packages/api` — see `servers/demo1/CLAUDE.md`'s Kafka producer section) — not the
  `ts-proto` message type used for `config.topics`/gRPC, those are two different codegen outputs
  for the same `.proto` file. Throws if called for a topic with no schema registered.
- `deserialize()` needs **no schema at all** — `ProtobufDeserializer` fetches whatever schema the
  producer actually registered, by the ID embedded in the message's wire format, so decode stays
  correct as the producer's schema evolves (as long as the change stays BACKWARD-compatible).
  `schemas` is entirely optional when a `SchemaRegistryKafkaSerializer` instance is only ever used
  to decode (e.g. `demo2`, a consumer-only server).
- **Configured once on `KafkaDriverConfig.serializer`, resolved everywhere else via the
  container** — `KafkaDriver.start()` registers it as `kafkaSerializer` (`asValue`, before any
  router's `topics`/`dispatchers` are read) whenever `config.serializer` is set, regardless of
  whether the server produces, consumes, or both — one Schema Registry client per server, shared
  by every topic and every router, configured in exactly one place (`app.ts`, alongside
  `brokers`/`groupId`). Since `KafkaConsumerRouter.topics` (below) unconditionally resolves
  `kafkaSerializer`, any server with a `KafkaConsumerRouter` **must** set `config.serializer` on
  its `KafkaDriver` entry — there's no longer a way to skip Schema Registry for one topic.
- **`KafkaConsumerRouter.topics` is concrete, not abstract** — a subclass only implements
  `topicTypes` (the topic-to-generated-message-type declaration) and `handlers`; the base class's
  `topics` getter resolves `kafkaSerializer` from the container and binds `deserialize()` to every
  entry in `topicTypes` itself:
  - `topicTypes` is the exact `{ topicName: tsProtoGeneratedMessage }` shape already used for
    `config.topics` (e.g. `{ 'demo1.events': Demo1Demo1eventProto.Demo1Event }`) — only each
    entry's `decode()` *return type* is used for inference; the entry's own `decode()` is never
    actually called, since the real decode always goes through the resolved `KafkaSerializer`.
    `DecodedTopics<TTopicTypes>` (exported from `server`) is the mapped type describing what
    `topics` actually returns, if you need to reference that shape directly.
  - Resolved **lazily on every access**, not cached from the constructor: `ServerApp.run()`
    constructs all routers (`new R(container)`) before any driver's `start()` runs, and
    `KafkaDriver` only registers `kafkaSerializer` inside its own `start()` — resolving eagerly in
    a router's constructor would throw, since nothing has registered it yet at that point.
- Both factory params (`createMessage`, defaulting to `@bufbuild/protobuf`'s `create`, and
  `createSerde`, defaulting to a real `SchemaRegistryClient` backing both a `ProtobufSerializer`
  and a `ProtobufDeserializer`) are injectable — same testability pattern as `KafkaDriver`'s
  `createKafka` — so tests never hit a real registry over the network.
- **Sharing a topic's declaration across servers**: `demo1EventsTopics`/`demo1EventsSchemas` are
  hand-written exports from `packages/api` (`src/kafka/topics.ts` — not under `src/generated/`, so
  not produced by `APIGenerator`; see `packages/api/CLAUDE.md`), pairing a topic name with its
  generated message/schema types once so `demo1` (producer, `config.topics`/`serializer.schemas`)
  and `demo2` (consumer, `topicTypes`) both import the same declaration instead of each
  re-declaring the `{ 'demo1.events': ... }` literal locally. A topic name isn't derivable from a
  `.proto` file itself (topic naming is a messaging-topology concern, not part of the wire schema),
  so this pairing is maintained by hand rather than generated — a custom protobuf option +
  protoc plugin could derive it in principle, but wasn't judged worth building for the number of
  topics in this monorepo today.
- **Topics are auto-provisioned before anything connects**, via `kafka.admin().createTopics()` over
  the union of `config.topics` and every `KafkaConsumerRouter.topics` — idempotent (a no-op, not an
  error, if the topic already exists across multiple servers provisioning the same topic). This is
  what actually fixes the "topic doesn't exist" race: a consumer subscribing to a topic that's never
  existed can throw `UNKNOWN_TOPIC_OR_PARTITION` and crash before the broker's own auto-create
  finishes propagating, even with `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true` — provisioning it explicitly
  up front removes the race entirely.
- `KafkaConsumerRouter<TTopicTypes>` is generic over a `{ topicName: protobufMessageType }` map,
  same shape as `GrpcRouter<TService>` — `KafkaHandlerMap<TTopicTypes>` infers each use case's
  `TInput` from that topic's message type via `Awaited<ReturnType<TTopicTypes[K]['decode']>>`, so
  the use case's `execute()` signature is checked against the actual message shape. Consumer use
  cases return `void` (fire-and-forget), unlike `BaseUseCase`'s request/response usage elsewhere.
- `KafkaMessageType<T>` only requires a `decode(input: Uint8Array): T | Promise<T>` method — any
  ts-proto generated message object (`Demo1Demo1Proto.Demo1`, etc.) satisfies it structurally. This
  is what lets `topicTypes` reuse a plain generated message type directly, and what
  `KafkaConsumerRouter.topics`'s decode functions (built from the resolved `KafkaSerializer`)
  return — `deserialize()` is itself `async`, matching `Promise<T>`.
- `register()` is a no-op (same reasoning as `GraphqlRouter`) — `KafkaDriver` reads
  `router.topics`/`router.dispatchers` directly instead.
- **`kafkajs`, not `@confluentinc/kafka-javascript`.** The latter ships a native librdkafka addon
  that is currently incompatible with the Bun runtime — loading it throws a raw V8 symbol lookup
  error (`undefined symbol: ...FunctionTemplate12SetClassName...`), not just an ABI-version
  mismatch; this is a confirmed, open upstream gap
  ([confluentinc/confluent-kafka-javascript#264](https://github.com/confluentinc/confluent-kafka-javascript/issues/264),
  [oven-sh/bun#24258](https://github.com/oven-sh/bun/issues/24258)), reproducible even after
  force-installing the matching Node-ABI prebuilt binary. `kafkajs` is pure JS with no native
  addon, so it works under Bun without caveats — do not switch back until those issues are closed.

### CronRouter + CronDriver

`CronDriver` runs scheduled background jobs using Bun's built-in **in-process** `Bun.cron()` —
no `node-cron`/external dependency. Like `KafkaDriver`, it doesn't bind a port and only acts on
routers it recognizes (duck-typed via `schedules`/`dispatchers`, same technique as
`isKafkaConsumerRouter`).

```ts
import { CronDriver, CronRouter, type CronHandlerMap } from 'server';
import CleanupStaleSessionsUseCase from '../usecases/CleanupStaleSessionsUseCase';

const schedules = { cleanup: '0 0 * * *' }; // five-field cron expression, UTC — see Bun.cron docs

export class DemoCronRouter extends CronRouter<typeof schedules> {
  get schedules() { return schedules; }
  get handlers(): CronHandlerMap<typeof schedules> {
    return { cleanup: CleanupStaleSessionsUseCase };
  }
}
```

```ts
import { CronDriver, GrpcDriver, ServerApp } from 'server';

ServerApp.init([
  { driver: GrpcDriver, port: 5001 },
  { driver: CronDriver, onReady: () => console.log('Cron jobs scheduled') },
])
  .routers([DemoGrpcRouter, DemoCronRouter])
  .run();
```

A server can also run **standalone as a cron-only server** — pass just `CronDriver` (bare or in a
single-element array) to `ServerApp.init()` with no gRPC/GraphQL/Kafka driver at all; the container,
`.database()`, `.plugins()` etc. all still work normally since they're driver-agnostic.

- `CronRouter<TSchedules>` mirrors `KafkaConsumerRouter<TTopics>`: abstract `schedules` (schedule
  name → cron expression, analogous to `topics`) and `handlers` (schedule name → `BaseUseCase`
  subclass). Handler use cases take no input and return nothing (`BaseUseCase<void, void>`) — a
  cron job doesn't decode a payload the way a Kafka message does. `dispatchers` auto-registers each
  use case transiently into the container exactly like `KafkaConsumerRouter.dispatchers` (token =
  `lcFirst(ClassName)`, skipped if already registered). `register()` is a no-op — `CronDriver` reads
  `.schedules`/`.dispatchers` directly.
- `CronDriver.start()` calls `Bun.cron(schedule, handler)` once per schedule entry across every
  `CronRouter` passed to `.routers()`, keeping the returned `Bun.CronJob` handles; `stop()` calls
  `.stop()` on each. Bun's in-process cron shares state across invocations (module-level
  variables, DB connections persist) and dies with the process — it does not survive a reboot or
  registration outside a running server. That's the deliberate tradeoff here (vs. Bun's other
  `Bun.cron(path, schedule, title)` overload, which spawns a fresh OS-level process per fire and
  survives reboots, but can't share the app's awilix container/DI-resolved use cases at all).
- **Error isolation**: `Bun.cron`'s docs say an uncaught throw/rejection from a job callback
  matches `setTimeout` semantics — without a listener, it takes the whole process down. `CronDriver`
  wraps every dispatch in `try/catch` so one failing job can't crash a multi-driver server, reporting
  through `CronDriverConfig.onError?: (error, name) => void` (defaults to `console.error`).
- Cron expressions are always interpreted in **UTC**, regardless of the host's `TZ` — same as
  `Bun.cron` itself.

### Abstract base classes

| Class | Purpose |
|---|---|
| `BaseDriver` | Protocol driver — `start(options)` / `stop()` |
| `BaseRouter` | Route registration — `register(server)` |
| `BaseUseCase<TIn, TOut>` | Business logic — `execute(input)` |
| `ProcessOrchestrator<TContext>` | Orchestrated SAGA — `build()` registers `step(main, fallback, options?)` |
| `BaseRepository<TClient>` | Data access — constructor receives `{ prisma }` |
| `BaseInterceptor` | Request middleware — `apply(server)` |
| `BasePlugin` | Infrastructure adapter — `onStart()` / `onStop()` |

## Testing

Run with `bun run test` (NOT `bun test` — tests must run inside the rstest environment).

- `vi` is NOT exported from `@rstest/core`. Use manual test doubles instead of module mocking.
- Make drivers testable by injecting server/factory via constructor rather than instantiating internally.

## awilix PROXY mode — constructor pattern

All classes registered in the container **must** destructure from a single object argument:

```ts
// CORRECT — awilix PROXY passes a proxy object, destructure what you need
constructor({ demoRepository }: { demoRepository: DemoRepository }) { ... }

// WRONG — awilix passes the entire cradle proxy as the first arg
// so _demoRepository will be the proxy itself, not the resolved class
constructor(private readonly _demoRepository: DemoRepository) { ... }
```

The bug symptom: "Could not resolve 'create'" — awilix passes the proxy as `_demoRepository`,
then `_demoRepository.create(...)` causes the proxy to try resolving 'create' from the container.

## Dependencies

- `awilix` — DI container (PROXY injection mode)
- `@grpc/grpc-js` — dev dep, peer dep for consuming servers
- `@apollo/server` + `@apollo/subgraph` — dev deps, peer deps for consuming servers
- `graphql` — dev dep, peer dep — **pinned to `^16.11.0`**, not v17 (ESM-only, breaks
  `@apollo/subgraph`'s internal `require('graphql')` under Bun)
- `kafkajs` — dev dep, peer dep for consuming servers; pure JS, no native binding (see
  KafkaDriver above for why `@confluentinc/kafka-javascript` was rejected)
- `@confluentinc/schemaregistry` + `@bufbuild/protobuf` — dev deps, required by
  `SchemaRegistryKafkaSerializer` (see "Kafka serialization" above). `@bufbuild/protobuf` is
  bundled into `dist` like `kafkajs` is; `@confluentinc/schemaregistry` is **marked external** in
  `rslib.config.ts` (`'@confluentinc/schemaregistry': 'module @confluentinc/schemaregistry'`) —
  every consuming server must have it as a **direct runtime dependency** (`demo1`/`demo2` both do).
  This isn't just a size optimization — bundling it is a genuine runtime crash:
  `@confluentinc/schemaregistry`'s `index.js` unconditionally `require`s every optional
  encryption-rule driver (AWS KMS, GCP KMS, etc.) even though `SchemaRegistryKafkaSerializer` only
  uses plain `ProtobufSerializer`/`ProtobufDeserializer`. Bundling that chain (GCP KMS ->
  `google-gax` -> `readable-stream`) breaks at runtime — `readable-stream`'s
  `util.inherits(Readable, Stream)` throws `TypeError: The "superCtor.prototype" property must be
  of type object. Received undefined`, because Rspack's bundling of that chain's
  `require('stream')` doesn't resolve Node's core `stream` module the way `readable-stream`
  expects. Externalizing it resolves the whole package from the consuming server's own
  `node_modules` at runtime (real Node/Bun module resolution, not Rspack's), sidestepping the
  bundling bug entirely — confirmed by running `demo1`/`demo2` after the fix, both boot cleanly.
  Bundling everything (the pre-fix state) also roughly tripled `server`'s built size (~2.5MB →
  ~7.6MB) for the unused KMS chain alone — externalizing fixes that too, as a side effect.
- `RedisPlugin` uses Bun's built-in `RedisClient` (`import { RedisClient } from 'bun'`) — no
  npm dependency needed, unlike the Kafka/gRPC/GraphQL drivers. See its Interceptors vs Plugins
  section above for why that import has to be lazy, and why `rslib.config.ts` marks `bun` external.
- `meilisearch` — official JS SDK for `MeilisearchPlugin`, a regular npm dependency (unlike
  `RedisPlugin`'s Bun builtin) bundled directly into `dist` like `kafkajs`, no `rslib.config.ts`
  external needed.
- `pg` + `@prisma/adapter-pg` — required by `PgAdapter` for Prisma 7 driver adapter
- `@prisma/client-runtime-utils` — required by Prisma 7 (install explicitly if missing)
- `PrismaAdapter` class is deleted — logic lives directly in `ServerApp.database()`

## GraphQL federation

`ApolloDriver` builds an Apollo Federation **subgraph** schema (`buildSubgraphSchema` from `@apollo/subgraph`)
from each router's `typeDefs`/`resolvers`, rather than passing them to `ApolloServer` directly. This means:

- `typeDefs` may use federation directives (`@key`, `@external`, `@shareable`, etc.) — including the
  federation-annotated typeDefs generated into `packages/api`.
- Entity types need a `__resolveReference` resolver, keyed by type name in `GraphqlHandlerMap` just like any
  other field:
  ```ts
  get handlers(): GraphqlHandlerMap {
    return {
      Query: { demo1: Demo1UseCase },
      Demo1: { __resolveReference: ResolveDemo1ReferenceUseCase },
    };
  }
  ```
- `ApolloDriver` still uses `startStandaloneServer`, so each server runs as a standalone subgraph — federating
  multiple subgraphs behind a gateway/router is out of scope here (use `@apollo/gateway` or the Apollo Router
  in front of these subgraph endpoints).
- **`server`'s `graphql` dependency is pinned to `^16.11.0`**, matching `@apollo/server`/`@apollo/subgraph` peer
  deps and every server in the monorepo. `graphql@17` is ESM-only and breaks `@apollo/subgraph`'s internal
  `require('graphql')` under Bun ("Cannot require() ES Module ... not yet fully loaded") — do not bump past v16
  until Apollo's federation packages support it.

## Multi-protocol servers

Preferred: pass multiple drivers to one `ServerApp.init([...])` call (see above) — this shares one
awilix container across all protocols, so a gRPC-facing repository and a GraphQL-facing one can be
registered once and injected into both.

Older pattern (still works, but isolates each protocol's container — no shared DI state):

```ts
await Promise.all([
  ServerApp.init([GrpcDriver]).routers([DemoGrpcRouter]).port(5001).run(),
  ServerApp.init([ApolloDriver]).routers([DemoGraphqlRouter]).port(4001).run(),
]);
```

## Turborepo / environment

- Run `bun dev` at repo root — requires `turbo` with the correct platform binary installed
- On Windows: `turbo` needs `@turbo/windows-64` and the Visual C++ Redistributable (2015–2022); **WSL is the recommended alternative**
- Default `ServerApp` host is `0.0.0.0` — using `localhost` on Windows causes gRPC to fail binding (tries both `::1` and `127.0.0.1`)
- `server` must be built (`bun run build`) before servers can start — `turbo.json`'s `dev` task
  declares `"dependsOn": ["^build"]`, so `turbo run dev` builds `server` (and any other workspace
  dependency, e.g. `script`/`api`) automatically before starting a dependent server's `dev` watcher;
  a standalone `bun run build` is only needed if you're running a server outside of `turbo run dev`
  (e.g. `bun run index.ts` directly against a stale/missing `dist`)

## Generated API (packages/api)

Proto and GraphQL types are generated once and committed — no CI regeneration needed.
Generator is `ts-proto` (via `buf generate`), NOT `@bufbuild/protoc-gen-es`, despite using the buf CLI.
Generated types use `@grpc/grpc-js` interfaces.
