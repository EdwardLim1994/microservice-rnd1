import { pluginReact } from '@rsbuild/plugin-react';
import { withRsbuildConfig } from '@rstest/adapter-rsbuild';
import { defineConfig } from '@rstest/core';

// Docs: https://rstest.rs/config/
export default defineConfig({
  // @rstest/core pins its own @rsbuild/core (~2.0.15, resolving @rspack/core@2.0.8), older than
  // rsbuild.config.ts's own @rsbuild/core (^2.1.4, resolving @rspack/core@2.1.2) — the version
  // @rsbuild/plugin-react's `reactCompiler` option requires for its builtin:swc-loader
  // integration. That mismatch makes `bun run test` fail with "unknown field `reactCompiler`"
  // even though `bun run dev`/`build` (which resolve the newer @rspack/core) work fine. Swap in a
  // `reactCompiler`-less instance of the same plugin just for the test build — every other
  // rsbuild.config.ts plugin/setting still applies as-is.
  extends: withRsbuildConfig({
    modifyRsbuildConfig: (config) => ({
      ...config,
      plugins: config.plugins
        ?.map((plugin) =>
          plugin && typeof plugin === 'object' && 'name' in plugin && plugin.name === 'rsbuild:react'
            ? pluginReact()
            : plugin,
        )
        // Module Federation's plugin injects a __webpack_require__.C (share-scope) runtime that
        // only gets bootstrapped when the app actually loads through src/bootstrap.tsx as a real
        // federated entry — rstest renders App directly via testing-library, never going through
        // that bootstrap, so the runtime is never initialized and any federated/shared import
        // (react, react-dom) blows up with "__webpack_require__.C is not a function". Not needed
        // for component tests anyway (they don't exercise cross-remote loading), so drop it here.
        .filter(
          (plugin) =>
            !(
              plugin &&
              typeof plugin === 'object' &&
              'name' in plugin &&
              plugin.name === 'rsbuild:module-federation-enhanced'
            ),
        ),
    }),
  }),
  setupFiles: ['./tests/rstest.setup.ts'],
});
