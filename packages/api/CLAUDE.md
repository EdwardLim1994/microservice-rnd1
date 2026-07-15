# packages/api

Shared API types package — generated proto (gRPC) and GraphQL types produced by each server, so
other servers can import them without owning a copy of the `.proto`/schema files themselves.

There is no hand-written business logic here: everything under `src/generated/` is produced by
`APIGenerator` (see `packages/script/CLAUDE.md`) and committed to the repo — no CI regeneration step.
Treat `src/generated/**` as read-only; edit the source server's proto/GraphQL schema instead and
regenerate.

## Layout

`src/generated/<serverName>/` — one folder per server that publishes types, e.g. `demo1`, `demo2`:
- `proto/` — `ts-proto` output for that server's `.proto` file(s), plus `google/` well-known types
  and `typeRegistry.ts`, each with barrel `index.ts` files.
- `graphql/` — codegen output (`typedefs.ts`/`.graphql`, `resolvers.ts`, `context.ts`).
- `protobufes/` — only present when a server also needs `@bufbuild/protobuf` (protobuf-es)
  descriptors, e.g. `demo1/protobufes/demo1_pb.ts` + `demo1event_pb.ts` for Confluent Schema
  Registry serialization (see `servers/demo1/CLAUDE.md`). **Not** picked up by `APIGenerator`'s
  barrel step (which only scans `graphql/`/`proto/` per server) — every export from here in
  `src/generated/index.ts` (`Demo1ProtobufEs`, `Demo1EventProtobufEs`, one per `_pb.ts` file) is
  hand-added and must be re-added if the top-level barrel is ever regenerated from scratch (running
  `bun run gen` silently drops all of them, since it only writes what it scanned).

`src/generated/index.ts` — top-level barrel, grouping exports by server name and type, e.g.
`Demo1Graphql`, `Demo1Demo1Proto`, `Demo1ProtobufEs`. This is the file other packages actually
import from (`import { Demo1Demo1Proto } from 'api'`).

## Regenerating

Run `APIGenerator` from the owning server (not from here) — see `packages/script/CLAUDE.md`'s
APIGenerator section, or the regeneration command in the relevant `servers/<name>/CLAUDE.md`
(e.g. `servers/demo1/CLAUDE.md` documents the `buf generate` invocation and the barrel-recovery
caveat if subdirectory barrels go missing after a regen).

## Dependencies

- `@grpc/grpc-js` — types referenced by generated proto output.
- `graphql` — types referenced by generated GraphQL output. Currently pinned to `^17.0.1` here,
  which is **inconsistent** with `packages/server`'s pin to `^16.11.0` (kept below v17 specifically to
  avoid breaking `@apollo/subgraph`'s CJS `require('graphql')` under Bun — see
  `packages/server/CLAUDE.md`). Since servers depend on both `api` and `server`, this mismatch is worth
  reconciling rather than treating as settled.
- `@bufbuild/protobuf` — only needed for the `protobufes/` output.

## Turborepo / environment

Bun defaults (`bun install`, `bunx`, etc.) apply, same as the rest of the monorepo — see the root
`CLAUDE.md`. This package has no runtime server of its own; `build` (rslib) just compiles
`src/index.ts` to `dist/` for other workspace packages to consume.
