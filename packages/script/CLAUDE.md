# packages/script

Standalone package for codegen/tooling scripts used across servers. Built with rslib, tested with
rstest — same setup as `packages/server`, but kept separate since these scripts aren't part of the
runtime framework servers depend on.

## APIGenerator

`APIGenerator` is a fluent builder for generating proto and GraphQL API types into `packages/api`.
Every server's `"gen"` script (added by the `grpc`/`graphql` `turbo gen server` extensions) runs
the same shared entrypoint, `packages/script/src/bin/generate-api.ts`:

```ts
// packages/script/src/bin/generate-api.ts — identical for every server, no per-server wrapper
import APIGenerator from '../generator/APIGenerator';

await APIGenerator.init().withBarrel('../../packages/api/src/generated').generate();

process.exit();
```

```json
// any server's package.json
"scripts": { "gen": "bun ../../packages/script/src/bin/generate-api.ts" }
```

- `APIGenerator.init(projectName?)` — `projectName` defaults to `basename(process.cwd())`, i.e.
  the invoking server's own directory name (`bun run gen` always runs with cwd set to that
  server's workspace). This is what lets one script file serve every server: there's no name to
  hand-supply, so no per-server file is needed just to close over it. Still accepts an explicit
  name for direct/test use (`APIGenerator.init('demo1')`).
- Checks for `graphql-codegen.exe` and `protoc.exe` in `node_modules/.bin` before running — skips gracefully if not found
- After proto generation, writes `index.ts` barrel files recursively into each proto subdirectory
- Writes a top-level `index.ts` barrel grouping exports by server name and type (e.g. `Demo1Graphql`, `Demo1Demo1Proto`)
- Uses `chalk` for coloured log output (`log.info`, `log.warn`, `log.error`, `log.success`)
- Helper utilities also exported: `writeSubDirBarrels`, `collectSubDirExports`, `createFolder`, `checkDependency`, `log`

## ReleaseManager

`ReleaseManager` drives this repo's release branching/tagging (cut-release, bump-rc, promote,
hotfix, touched-apps — see the root `CLAUDE.md`'s Branch/Tag Strategy). The root `package.json`'s
`release:*` scripts all run the same shared entrypoint, `packages/script/src/bin/release-manager.ts`:

```json
// root package.json
"release:cut": "bun ./packages/script/src/bin/release-manager.ts cut-release",
```

`release-manager.ts` parses `process.argv` into a command + args, dispatches to the matching
`ReleaseManager` method, and prints the result as JSON to stdout (errors go to stderr via `log.error`
and exit 1) — `.github/workflows/cd-hotfix.yml` captures that stdout JSON directly
(`result=$(bun ./packages/script/src/bin/release-manager.ts hotfix "$app")`, piped into `jq`).
Like `generate-api.ts` below, it imports `ReleaseManager`/`log` by relative path (not as `script`'s
package export), so no `bun run build --filter=script` step is needed before running it.

## Layout

- `src/generator/` — `APIGenerator.ts` (the class above), `index.ts` (barrel, `export { default as
  APIGenerator } from './APIGenerator'`).
- `src/release/` — `ReleaseManager.ts` (the class above) plus `apps.ts`/`manifest.ts`/`version.ts`
  helpers, `index.ts` (barrel).
- `src/bin/` — CLI entrypoints run directly via `bun` by relative path (never imported as `script`'s
  package export, never built to `dist`): `generate-api.ts` (every server's `"gen"` script) and
  `release-manager.ts` (the root `release:*` scripts).
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
