import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// PUBLIC_-prefixed vars (e.g. PUBLIC_GRAPHQL_URL, see src/shared/libs/apolloClient.ts) become
// available as import.meta.env.PUBLIC_X at runtime.
const { publicVars } = loadEnv();

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  source: {
    define: publicVars,
  },
  server: {
    port: 3000,
  },
  dev: {
    // Default bakes in http://localhost:3000 for every asset URL (JS/CSS chunks, favicon) —
    // breaks the moment this is reached via any other host (Traefik's web1.lan Ingress, another
    // device on the LAN). 'auto' derives the prefix from whatever host actually served the page.
    assetPrefix: 'auto',
  },
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
    pluginTailwindcss(),
    pluginModuleFederation({
      name: 'web1',
      remotes: {
        // Loaded by the *browser*, not this Node process — "localhost" only resolves for
        // whoever's own machine is running the browser. Same PUBLIC_ override pattern as
        // src/shared/libs/apolloClient.ts's PUBLIC_GRAPHQL_URL: for LAN/other-device access, set
        // PUBLIC_MFE1_URL=http://mfe1.lan:8080 (Traefik's Ingress-routed host, reachable from any
        // device that can already reach web1.lan — see mfe1's own helm/templates/ingress.yaml).
        mfe1: `mfe1@${process.env.PUBLIC_MFE1_URL ?? 'http://localhost:3001'}/static/js/mfe1.js`,
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
