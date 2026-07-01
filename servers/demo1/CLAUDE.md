
# servers/demo1

Producer-only Kafka server (no `KafkaConsumerRouter`) plus gRPC + GraphQL, all off one
`ServerApp.init([...])` — see `src/app.ts`.

## Kafka producer + Schema Registry

`src/usecases/TestDemoUseCase.ts` publishes to topic `demo1.events` on every `TestDemo` gRPC call,
via Confluent Schema Registry (not raw `ts-proto` `encode()`):

- Uses `create(Demo1ProtobufEs.Demo1Schema, {...})` (`@bufbuild/protobuf`/protobuf-es) +
  `ProtobufSerializer.serialize()` (`@confluentinc/schemaregistry`), **not** `ts-proto`'s
  `Demo1Demo1Proto.Demo1.encode()` — the registry's serializer needs protobuf-es's descriptor
  reflection metadata, which `ts-proto`'s plain interfaces don't carry. `ts-proto`'s `Demo1Demo1Proto`
  is still used for the gRPC response and for `demo1.proto`'s other consumers — only the Kafka
  payload goes through protobuf-es.
- `demo1.proto` is generated **twice** by `buf` (see `src/configs/proto/buf.gen.yaml`): once via
  `protoc-gen-ts_proto` (existing, for gRPC — `packages/api/.../demo1/proto/`) and once via
  `protoc-gen-es` (new, for the Schema Registry — `packages/api/.../demo1/protobufes/`), exported
  from `packages/api` as `Demo1ProtobufEs` (hand-added to `packages/api/src/generated/index.ts` —
  the barrel generator only scans `graphql/`/`proto/` per server, not `protobufes/`).
- `autoRegisterSchemas: true` — registers/validates the schema against Confluent Schema Registry on
  first use; a produce fails if the message is no longer BACKWARD-compatible with the previously
  registered schema for `demo1.events-value`, catching drift at the source instead of silently
  breaking `demo2`'s decode.
- Config via `.env` (gitignored): `KAFKA_BROKERS`, `SCHEMA_REGISTRY_URL` — both have a host-vs-Docker
  split (`localhost:29092`/`localhost:8081` for `bun run index.ts` on the host, `kafka:9092`/
  `schema-registry:8081` inside Docker) — see the commented-out alternates in `.env`.
- Regenerating protos: `cd servers/demo1 && PATH="$PWD/node_modules/.bin:$PATH" buf generate --template ./src/configs/proto/buf.gen.yaml` (the repo's `bun run gen` skips `buf generate`
  entirely on this machine — it checks for `protoc.exe`, a Windows-only check, so it always reports
  "Protoc is not installed" on Linux/WSL even though `protoc` is present). If you regenerate and the
  barrel `index.ts` files under `packages/api/.../demo1/proto/**` go missing, restore them with
  `writeSubDirBarrels` from `lib/script/barrel` — but do **not** call it on the top-level
  `demo1/proto/` dir itself, that produces an unused, broken barrel (ambiguous re-exports between
  `demo1.ts`/`typeRegistry.ts`/`google/`, which all define the same `ts-proto` helper types) that
  isn't part of the real structure (`demo2/proto/` has no such file either).

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
