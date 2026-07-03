import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

export default defineConfig({
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
    pluginTailwindcss(),
    pluginModuleFederation({
      name: 'portal',
      remotes: {
        frontend1: `frontend1@http://${process.env.FRONTEND1_HOST ?? 'localhost'}:3001/mf-manifest.json`,
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
      // Bun's npx doesn't auto-download packages; manage remote types manually via declare module
      dts: false,
    }),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
