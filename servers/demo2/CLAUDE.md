
# servers/demo2

Runs gRPC + GraphQL + a Kafka consumer (`KafkaDriver` + `DemoKafkaRouter`), all off one
`ServerApp.init([...])` — see `src/app.ts`. Also serves as a GraphQL federation subgraph extending
`demo1`'s `Demo1` type (`Demo1: { demo2: Demo2ByDemo1UseCase }`).

## Kafka consumer + Schema Registry

`src/routers/DemoKafkaRouter.ts` declares topic `demo1.events` (produced by `demo1`), decoded via
`server`'s `SchemaRegistryKafkaSerializer` (see `packages/server/CLAUDE.md`'s Kafka serialization
section — the same class `demo1` uses to produce, since it's one shared strategy for both
directions of a topic), dispatched to `src/usecases/LogDemo1EventUseCase.ts`.

- **Decode itself needs no local codegen or `.proto` file** — `SchemaRegistryKafkaSerializer`
  fetches whatever schema `demo1` actually registered (by the schema ID embedded in the message's
  wire format), so this keeps working even if `demo1`'s schema evolves, as long as the change stays
  BACKWARD-compatible. `demo2` does still import the **type** for compile-time safety, though —
  `demo1EventsTopics` from `api` (`packages/api/src/kafka/topics.ts`, hand-written — see
  `packages/api/CLAUDE.md`), the same declaration `demo1` uses for its own `config.topics`, not a
  hand-written structural interface duplicating `{ id, name }`. `demo2` doesn't own or regenerate
  `demo1event.proto` itself; it only imports the shared topic declaration, same as it already does
  for `Demo1GoogleProtobuf`.
- **`DemoKafkaRouter.ts` only declares which topics it consumes — decode is fully automatic.** The
  whole router is:
  ```ts
  import { demo1EventsTopics } from "api";
  import { KafkaConsumerRouter, type KafkaHandlerMap } from "server";

  export default class DemoKafkaRouter extends KafkaConsumerRouter<typeof demo1EventsTopics> {
    get topicTypes() { return demo1EventsTopics; }
    get handlers(): KafkaHandlerMap<typeof demo1EventsTopics> {
      return { "demo1.events": LogDemo1EventUseCase };
    }
  }
  ```
  `KafkaConsumerRouter.topics` (concrete on `server`'s base class — see `packages/server/CLAUDE.md`'s
  Kafka serialization section) resolves `kafkaSerializer` from the container and binds
  `deserialize()` to every entry in `topicTypes` automatically — the router never calls
  `this.container.resolve(...)` itself, never constructs a `SchemaRegistryKafkaSerializer` (or a
  `SchemaRegistryClient`/`ProtobufDeserializer`), and never hand-writes a `KafkaMessageType<T>`
  mapped type. This is a framework-wide convention, not opt-in per router: every
  `KafkaConsumerRouter` decodes through Schema Registry, so `KafkaDriver`'s `config.serializer` is
  effectively required whenever a server has one (see `src/app.ts`). The `kafkaSerializer` itself
  is still configured once, on `KafkaDriver`'s `config.serializer`
  (`new SchemaRegistryKafkaSerializer()`, no `schemas` needed — decode-only). If `demo2` ever adds
  a second consumer topic, extending `topicTypes`/`demo1EventsTopics` reuses the same
  `kafkaSerializer` resolution rather than standing up another client.
  `@confluentinc/schemaregistry` **is still a direct dependency of `demo2`**, even though the code
  using it (`SchemaRegistryKafkaSerializer`) lives in `server` — `server`'s `rslib.config.ts` marks
  `@confluentinc/schemaregistry` external rather than bundling it (see `packages/server/CLAUDE.md`'s
  Dependencies section for why: bundling its GCP KMS encryption-rule chain crashes at runtime with
  `TypeError: The "superCtor.prototype" property must be of type object`), so it has to be
  resolvable from the actual running server's own `node_modules` instead.
- Config via `.env` (gitignored): `KAFKA_BROKERS`, `KAFKA_GROUP_ID`, `SCHEMA_REGISTRY_URL` — same
  host-vs-Docker address split documented in `servers/demo1/CLAUDE.md`.

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
