# packages/script

Standalone package for codegen/tooling scripts used across servers. Built with rslib, tested with
rstest — same setup as `packages/server`, but kept separate since these scripts aren't part of the
runtime framework servers depend on.

## APIGenerator

`APIGenerator` is a fluent builder for generating proto and GraphQL API types into `packages/api`.
Each server's `src/scripts/generate_api.sh.ts` wraps it and is run via `bun run gen`:

```ts
import { APIGenerator } from 'script';

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

## Layout

- `src/generator/` — `APIGenerator.ts` (the class above), `index.ts` (barrel, `export { default as
  APIGenerator } from './APIGenerator'`).
- `src/helper/` — `barrel.ts` (`writeSubDirBarrels`, `collectSubDirExports`), `common.ts` (`log`,
  `createFolder`, `checkDependency`), `index.ts` (barrel for this directory).
- `src/index.ts` — package's top-level barrel (`export * from './generator'; export * from
  './helper'`).
- `tests/` mirrors `src/` (`tests/generator/`, `tests/helper/`) rather than living alongside the
  source files.

Consuming servers depend on this package as `"script": "workspace:*"` and resolve it via a
`tsconfig.json` `paths` entry (`"script": ["../../packages/script/src/index.ts"]`) pointing
straight at source, the same pattern used for `api` in each server's `tsconfig.json` — unlike
`server`, which has no such mapping and resolves through the real built `dist` (see
`packages/server/CLAUDE.md`'s Turborepo/environment note — `turbo.json`'s `dev` task depends on
`^build`, so that's built automatically before a server's `dev` starts, not a manual step).

## Commands

- `bun run build` - Build the library for production
- `bun run dev` - Turn on watch mode, watch for changes and rebuild the library
- `bun run test` - Run tests

## Tools

### Biome

- Run `bun run check` to lint and format your code (writes fixes)
