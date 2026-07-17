import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

export default defineConfig({
  plugins: [
    // reactCompiler needs @rspack/core >= 2.1.0; rstest's own bundler resolves an older 2.0.8
    // that's also present in the workspace, so turning this on breaks `bun run test` with
    // "unknown field `reactCompiler`" from swc-loader. Re-enable once the version skew is fixed.
    pluginReact(),
    pluginTailwindcss(),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
