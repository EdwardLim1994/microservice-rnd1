# packages/lib

Shared library used by all servers in this monorepo. Built with rslib, tested with rstest.

## Architecture

### ServerApp — fluent builder, owns the awilix DI container

`ServerApp.init()` takes an **array of drivers**, not a single one — each driver runs its own
protocol (gRPC, GraphQL, Kafka consumer, ...) but they all share one awilix container, one set of
routers/interceptors/plugins, and one lifecycle:

```ts
import { ApolloDriver, GrpcDriver, KafkaDriver, PgAdapter, ServerApp, singleton } from 'lib';

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
  .database(PrismaClient, new PgAdapter(process.env.DATABASE_URL))  // adapter from lib, no factory fn needed
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

`ServerApp.database(ClientClass, dbAdapter)` accepts the Prisma client class and a `DbAdapter` instance. Internally it:
- Instantiates `new ClientClass({ adapter: dbAdapter.adapter })`
- Registers client as `prisma` (singleton) in the container
- `run()` calls `$connect()`, `stop()` calls `$disconnect()` then `dbAdapter.end()`

`PgAdapter` is provided by lib (PostgreSQL). To add another database in future, create a class implementing `DbAdapter`:
```ts
export interface DbAdapter {
  readonly adapter: unknown;
  end(): Promise<void>;
}
```

```ts
import { PgAdapter } from 'lib';
.database(PrismaClient, new PgAdapter(process.env.DATABASE_URL))
// PgAdapter accepts a connection string or pg PoolConfig object
```

Each server has its own Prisma schema, config, and generated client:
- Schema: `servers/<name>/src/schemas/prisma/schema.prisma`
- Config: `servers/<name>/prisma.config.ts` using `defineConfig` (Prisma 7 — replaces `package.json` `prisma` field)
- Migrations: `servers/<name>/src/schemas/prisma/migrations/`
- Generated client output: `src/generated/prisma` (gitignored, regenerated via `postinstall`)
- `.env` at server root — Bun loads it automatically, no dotenv needed

### Registering dependencies

Repositories must be registered via `.containers()` using helpers from lib — no awilix import needed in servers:

```ts
import { singleton, transient } from 'lib';

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
repositories/use cases can inject them from the cradle. `RedisPlugin` (`lib`'s own implementation)
is the concrete example:

```ts
import { RedisPlugin, ServerApp } from 'lib';

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

Kafka is **not** modeled as a plugin — see `KafkaDriver` below. It needs producer/consumer/admin
lifecycle tied to the same driver-level config (`config` on a `DriverEntry`), and no separate
plugin instance to duck-type through `DriverStartOptions.plugins`.

### KafkaConsumerRouter + KafkaDriver

One `KafkaDriver` owns the entire Kafka relationship for a server — producer, consumer (if the
server has any `KafkaConsumerRouter`s), and topic provisioning — configured directly via a
`DriverEntry`'s `config`, the same way `GrpcDriver`/`ApolloDriver` take `port`/`host`.

```ts
import { Demo1Demo1Proto } from 'api';
import { KafkaConsumerRouter, type KafkaHandlerMap } from 'lib';
import LogDemo1EventUseCase from '../usecases/LogDemo1EventUseCase';

const topics = { 'demo1.events': Demo1Demo1Proto.Demo1 }; // any ts-proto generated message works —
                                                            // it already has the decode() shape KafkaMessageType<T> needs

export class DemoKafkaRouter extends KafkaConsumerRouter<typeof topics> {
  get topics() { return topics; }
  get handlers(): KafkaHandlerMap<typeof topics> {
    return { 'demo1.events': LogDemo1EventUseCase };
  }
}
```

Consumer server (has a `KafkaConsumerRouter` — e.g. `demo2`):

```ts
import { ApolloDriver, GrpcDriver, KafkaDriver, ServerApp } from 'lib';

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
  config: { topics: { 'demo1.events': Demo1Demo1Proto.Demo1 } },
  onReady: () => console.log('Kafka producer is running'),
}
```

- `KafkaDriverConfig` (the `config` on a `DriverEntry`): `brokers?`, `clientId?`, `groupId?` (each
  falls back to `KAFKA_BROKERS`/`KAFKA_CLIENT_ID`/`KAFKA_GROUP_ID` env vars, then a hardcoded
  default), and `topics?: Record<string, KafkaMessageType<any>>` — topics to provision that no
  router already declares (the producer side's equivalent of a router's `topics` getter).
- `start()` always connects a producer and registers `kafka` (raw client) + `kafkaProducer` into
  `DriverStartOptions.container`, so any repository/use case can inject `kafkaProducer` from the
  cradle exactly like injecting a repository. It only creates/subscribes a consumer if at least one
  `KafkaConsumerRouter` was passed to `.routers()` — a produce-only server never joins a consumer
  group.
- **Topics are auto-provisioned before anything connects**, via `kafka.admin().createTopics()` over
  the union of `config.topics` and every `KafkaConsumerRouter.topics` — idempotent (a no-op, not an
  error, if the topic already exists across multiple servers provisioning the same topic). This is
  what actually fixes the "topic doesn't exist" race: a consumer subscribing to a topic that's never
  existed can throw `UNKNOWN_TOPIC_OR_PARTITION` and crash before the broker's own auto-create
  finishes propagating, even with `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true` — provisioning it explicitly
  up front removes the race entirely.
- `KafkaConsumerRouter<TTopics>` is generic over a `{ topicName: protobufMessageType }` map, same
  shape as `GrpcRouter<TService>` — `KafkaHandlerMap<TTopics>` infers each use case's `TInput` from
  that topic's message type via `Awaited<ReturnType<TTopics[K]['decode']>>`, so the use case's
  `execute()` signature is checked against the actual message shape. Consumer use cases return
  `void` (fire-and-forget), unlike `BaseUseCase`'s request/response usage elsewhere.
- `KafkaMessageType<T>` only requires a `decode(input: Uint8Array): T | Promise<T>` method — any
  ts-proto generated message object (`Demo1Demo1Proto.Demo1`, etc.) satisfies it structurally, no
  new codegen needed to reuse an existing gRPC/GraphQL message type as a Kafka payload. The
  `Promise<T>` case is what lets a topic's `decode` be backed by an **async** deserializer instead —
  e.g. wrapping `@confluentinc/schemaregistry`'s `ProtobufDeserializer.deserialize()` (see
  `servers/demo2/CLAUDE.md` for the concrete pattern actually in use).
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

### Abstract base classes

| Class | Purpose |
|---|---|
| `BaseDriver` | Protocol driver — `start(options)` / `stop()` |
| `BaseRouter` | Route registration — `register(server)` |
| `BaseUseCase<TIn, TOut>` | Business logic — `execute(input)` |
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
- `RedisPlugin` uses Bun's built-in `RedisClient` (`import { RedisClient } from 'bun'`) — no
  npm dependency needed, unlike the Kafka/gRPC/GraphQL drivers. See its Interceptors vs Plugins
  section above for why that import has to be lazy, and why `rslib.config.ts` marks `bun` external.
- `pg` + `@prisma/adapter-pg` — required by `PgAdapter` for Prisma 7 driver adapter
- `@prisma/client-runtime-utils` — required by Prisma 7 (install explicitly if missing)
- `PrismaAdapter` class is deleted — logic lives directly in `ServerApp.database()`

## APIGenerator (script/)

`APIGenerator` is a fluent builder for generating proto and GraphQL API types into `packages/api`.

```ts
import { APIGenerator } from 'lib';

APIGenerator.init('demo1')
  .apiLocation('../../packages/api')
  .path('src/generated')
  .generate();
```

- Checks for `graphql-codegen.exe` and `protoc.exe` in `node_modules/.bin` before running — skips gracefully if not found
- After proto generation, writes `index.ts` barrel files recursively into each proto subdirectory
- Writes a top-level `index.ts` barrel grouping exports by server name and type (e.g. `Demo1Graphql`, `Demo1Demo1Proto`)
- Uses `chalk` for coloured log output (`log.info`, `log.warn`, `log.error`, `log.success`)
- Helper utilities also exported: `writeSubDirBarrels`, `collectSubDirExports`, `createFolder`, `checkDependency`, `log`

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
- **`lib`'s `graphql` dependency is pinned to `^16.11.0`**, matching `@apollo/server`/`@apollo/subgraph` peer
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
- `lib` must be built (`bun run build:lib`) before servers can start — turbo `dev` task has no `dependsOn` so build it manually first if needed

## Generated API (packages/api)

Proto and GraphQL types are generated once and committed — no CI regeneration needed.
Generator is `ts-proto` (via `buf generate`), NOT `@bufbuild/protoc-gen-es`, despite using the buf CLI.
Generated types use `@grpc/grpc-js` interfaces.
