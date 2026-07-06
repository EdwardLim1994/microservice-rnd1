# {{ name }}

Expo Router mobile app (iOS/Android), styled with HeroUI Native + Uniwind (Tailwind for React
Native), calling the backend GraphQL federation gateway (`services/apollo`) via Apollo Client —
same data-fetching pattern as `frontends/frontend1`.

## Layout

```
{{ name }}/
  src/
    app/                        # Expo Router file-based routes
      _layout.tsx                # root layout — wraps every route in GestureHandlerRootView →
                                  # ApolloProvider → HeroUINativeProvider, imports ../global.css
      index.tsx                  # home screen (HeroUI Native starter content)
    modules/<name>/               # one folder per feature, same repository/viewmodel/pages split
                                  # as frontend1's src/modules/<name>/ (see that app's CLAUDE.md) —
                                  # add with the "module" generator; a route under src/app/ then
                                  # renders that module's page (see src/app/_layout.tsx for the
                                  # provider stack it renders under)
      types/repository.ts        # gql query/mutation strings + hand-written result types
      viewmodel/use<Name>.ts      # thin wrapper around useQuery/useMutation from '@apollo/client/react'
      pages/<Name>Page.tsx        # React Native primitives (View/Text/...), not HTML — this is the
                                  # one layer that actually differs from frontend1's web version
    lib/apolloClient.ts          # createApolloClient(uri) — bare HttpLink + InMemoryCache, no auth/error links
    config/env.ts                # GRAPHQL_URL, read from EXPO_PUBLIC_GRAPHQL_URL
    global.css                  # Uniwind/Tailwind entry point (see metro.config.js)
  app.json                       # plugins: only list a package here if it actually ships a config
                                  # plugin for the installed version — see gotcha below
  biome.json                     # extends config/src/biome/biome.json, + local tailwindDirectives
                                  # override so `@source` in global.css parses
  .env / .env.sample              # EXPO_PUBLIC_GRAPHQL_URL — gitignored only as *.local, so the
                                  # checked-in .env's localhost default is fine to commit
```

`api` (generated types) and `config` (shared Biome config) are consumed as `workspace:*`
devDependencies — types-only, same as `frontend1`.

## Expo SDK pinned to 54, not latest

`expo` is pinned to `~54.0.0` deliberately — this is the SDK version the Expo Go app (App
Store/Play Store binary) actually supports for physical-device preview without building a custom
dev client. Bumping `expo` alone is not enough to upgrade/downgrade SDKs: every Expo/React
Native-adjacent package (`expo-router`, `expo-constants`, `react-native`,
`react-native-reanimated`, etc.) has its **own independent version number, not tied to the SDK
number** (e.g. SDK 54 ships `expo-constants@~18.0.13`, not `~54.x`). Don't hand-pick these
versions — run `bunx expo install --fix` (or `bunx expo install <pkg>` for a new dep) after
changing the `expo` version, and it resolves every dependency to the version that specific SDK
actually bundles. `bunx expo-doctor` catches most drift after the fact.

**Reanimated v4 + `react-native-worklets` do not work in Expo Go at all** (any SDK) — they require
the New Architecture and a custom dev client. `heroui-native` depends on both, so this app cannot
be previewed in Expo Go if either package is bumped past what SDK 54's Expo Go build tolerates;
the fix path is a dev client (`npx expo prebuild && npx expo run:ios`), not chasing versions.

**`app.json`'s `plugins` array is not safe to copy from a newer scaffold.** `expo-status-bar`
was listed there from the original SDK 57 template, but the SDK-54 version of that package
(`3.0.9`) doesn't export a config plugin — this makes `expo config`/the dev server throw
`PluginError` at startup with no other symptom. Only list a package in `plugins` if
`require(<pkg>)`'s main export is actually a config-plugin function for the version you have
installed.

## Env vars / physical device preview

`EXPO_PUBLIC_*` is the only prefix Expo inlines into the client bundle at build time (mobile's
equivalent of Rsbuild's `PUBLIC_*` used by `frontend1`). `localhost` in `.env` only resolves for a
simulator running on this same machine — a physical device (Expo Go via `--host tunnel`, the
`dev` script's mode) can't reach this machine's `localhost`. Point `EXPO_PUBLIC_GRAPHQL_URL` at a
device-reachable address instead — this machine's Tailscale IP (`tailscale ip -4`) if the phone is
on the same tailnet — and **restart** `bun dev` after editing `.env`; env vars are inlined at
bundle time, so a Fast Refresh won't pick up the change.

## Typed routes gotcha

Adding a new file under `src/app/` doesn't immediately show up in `expo-router`'s typed
`href`s (`.expo/types/router.d.ts`) via `tsc`/`bun run typecheck` alone, and `expo export` does
**not** regenerate it either. Only the interactive dev server (`bun dev` / `expo start`) triggers
the type-generation pass, on its first bundle. If `tsc` complains a new route string isn't
assignable to `href`, start the dev server once (it doesn't need to stay running) and re-run
`typecheck`.

## Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads `.env`, but Expo's own env handling (`EXPO_PUBLIC_*` inlining) is
  separate and still applies — see the Env vars section above.
