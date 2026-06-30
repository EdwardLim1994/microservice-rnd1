# packages/lib

Shared library used by all servers in this monorepo. Built with rslib, tested with rstest.

## Architecture

### ServerApp — fluent builder, owns the awilix DI container

```ts
import { GrpcDriver, PgAdapter, ServerApp, singleton } from 'lib';

ServerApp.init(GrpcDriver)
  .database(PrismaClient, new PgAdapter(process.env.DATABASE_URL))  // adapter from lib, no factory fn needed
  .containers({                   // register repositories — no awilix import needed in servers
    demoRepository: singleton(DemoRepository),
  })
  .routers([DemoRouter])
  .interceptors([AuthInterceptor])
  .plugins([KafkaPlugin])
  .port(3000)
  .host('0.0.0.0')
  .run((port, host) => console.log(`Running on ${host}:${port}`))
```

- Each `ServerApp.init()` call creates its own awilix container — no shared state across servers.
- `container` and `prisma` are registered automatically. Routers receive the container via constructor.
- Plugin instances created in `run()` are retained and reused in `stop()` — not re-instantiated.

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
| Examples | Auth, logging, OTel | Kafka, Redis, Meilisearch |

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
- `@apollo/server` — dev dep, peer dep for consuming servers
- `graphql` — dev dep, peer dep
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

`packages/api` generated typeDefs contain Apollo Federation directives (`@link`, `@key`, `@external`).
These are **incompatible** with standalone `ApolloDriver` (uses `startStandaloneServer`).
When using `GraphqlRouter` without federation, write plain inline typeDefs instead of importing from `api`:

```ts
get typeDefs() {
  return `
    type Demo1 { id: ID! name: String! }
    type Query { demo1: Demo1 }
  `;
}
```

Federation support requires replacing `ApolloDriver` with an Apollo Federation subgraph driver (future work).

## Multi-protocol servers

A server can run both gRPC and GraphQL by creating two `ServerApp` instances in the same `main()`:

```ts
await Promise.all([
  ServerApp.init(GrpcDriver).routers([DemoGrpcRouter]).port(5001).run(),
  ServerApp.init(ApolloDriver).routers([DemoGraphqlRouter]).port(4001).run(),
]);
```

Each instance has its own isolated awilix container.

## Turborepo / environment

- Run `bun dev` at repo root — requires `turbo` with the correct platform binary installed
- On Windows: `turbo` needs `@turbo/windows-64` and the Visual C++ Redistributable (2015–2022); **WSL is the recommended alternative**
- Default `ServerApp` host is `0.0.0.0` — using `localhost` on Windows causes gRPC to fail binding (tries both `::1` and `127.0.0.1`)
- `lib` must be built (`bun run build:lib`) before servers can start — turbo `dev` task has no `dependsOn` so build it manually first if needed

## Generated API (packages/api)

Proto and GraphQL types are generated once and committed — no CI regeneration needed.
Generator is `ts-proto` (via `buf generate`), NOT `@bufbuild/protoc-gen-es`, despite using the buf CLI.
Generated types use `@grpc/grpc-js` interfaces.
