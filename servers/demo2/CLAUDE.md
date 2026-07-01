
# servers/demo2

Runs gRPC + GraphQL + a Kafka consumer (`KafkaDriver` + `DemoKafkaRouter`), all off one
`ServerApp.init([...])` — see `src/app.ts`. Also serves as a GraphQL federation subgraph extending
`demo1`'s `Demo1` type (`Demo1: { demo2: Demo2ByDemo1UseCase }`).

## Kafka consumer + Schema Registry

`src/routers/DemoKafkaRouter.ts` declares topic `demo1.events` (produced by `demo1`), decoded via
`@confluentinc/schemaregistry`'s `ProtobufDeserializer`, dispatched to
`src/usecases/LogDemo1EventUseCase.ts`.

- **No local codegen or `.proto` file needed to consume** — `ProtobufDeserializer.deserialize()`
  fetches whatever schema `demo1` actually registered (by the schema ID embedded in the message's
  wire format), so this keeps working even if `demo1`'s schema evolves, as long as the change stays
  BACKWARD-compatible. `LogDemo1EventUseCase`'s input type (`Demo1Event { id, name }`) is a plain
  structural type, not imported from `demo1`'s generated types.
- The deserializer is wrapped to match `lib`'s `KafkaMessageType<T>` shape
  (`decode(input): Promise<T>`) directly in `DemoKafkaRouter.ts` — no change needed to
  `KafkaConsumerRouter`/`KafkaDriver` beyond `lib` allowing an async `decode` (see
  `packages/lib/CLAUDE.md`).
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
