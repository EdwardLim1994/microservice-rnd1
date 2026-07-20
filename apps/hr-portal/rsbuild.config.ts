import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// Scaffold never actually wired this up — src/config/env.ts reads `process.env.PUBLIC_GRAPHQL_URL`
// expecting Rsbuild to inline it at build time (the documented PUBLIC_* convention, see root
// CLAUDE.md), but without loadEnv()'s publicVars fed into source.define, the literal
// `process.env.PUBLIC_GRAPHQL_URL` expression survives untouched into the bundle — there's no
// `process` global in a browser, so it throws "process is not defined" the moment that module
// runs. Confirmed by dumping the built async chunk and finding the un-inlined string still there.
const { publicVars } = loadEnv();

export default defineConfig({
  source: {
    define: publicVars,
  },
  plugins: [
    pluginReact({
      // The resolved swc-loader binding under rstest (via @rstest/adapter-rsbuild's reuse of
      // this same config) doesn't recognize the `reactCompiler` jsc option key AT ALL — even
      // `reactCompiler: false` still writes the key into the jsc options JSON and fails the same
      // way, so it has to be omitted entirely, not just falsied. Confirmed unrelated to any app
      // code, reproduces on the bare scaffold before any component exists. `bun run test`/
      // `test:watch` set RSTEST=true specifically to omit it only for the test environment; the
      // real dev/build/preview commands are unaffected.
      ...(process.env.RSTEST === 'true' ? {} : { reactCompiler: true }),
    }),
    pluginTailwindcss(),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
