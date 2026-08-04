import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// PUBLIC_-prefixed vars (e.g. PUBLIC_GRAPHQL_URL, see src/shared/libs/apolloClient.ts) become
// available as import.meta.env.PUBLIC_X at runtime — same pattern as apps/web/web1.
const { publicVars } = loadEnv();

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  source: {
    define: publicVars,
  },
  server: {
    port: 3001,
  },
  dev: {
    // Default bakes in http://localhost:3001 for every asset URL (JS/CSS chunks, favicon) —
    // breaks the moment this is reached via any other host (Traefik's mfe1.lan Ingress, another
    // device on the LAN). 'auto' derives the prefix from whatever host actually served the page.
    assetPrefix: 'auto',
  },
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
    pluginTailwindcss(),
    pluginModuleFederation({
      name: 'mfe1',
      exposes: {
        './App': './src/App.tsx',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
      // Default dts:true injects a runtime plugin that opens a websocket to a companion
      // IDE extension (ws://127.0.0.1:<port>) for live remote-type hints — nobody runs that
      // extension here, so it always fails and spams the console. Not used, off.
      dts: false,
    }),
  ],
});
