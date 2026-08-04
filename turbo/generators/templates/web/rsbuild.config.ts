import { defineConfig, loadEnv } from '@rsbuild/core';
{{#if isMicrofrontend}}
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
{{/if}}
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
    host: '0.0.0.0',
    port: {{ port }},
  },
  dev: {
    // Default bakes in http://localhost:{{ port }} for every asset URL (JS/CSS chunks, favicon)
    // — breaks the moment this is reached via any other host (a Traefik Ingress, another device
    // on the LAN). 'auto' derives the prefix from whatever host actually served the page.
    assetPrefix: 'auto',
  },
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
    pluginTailwindcss(),
{{#if isMicrofrontend}}
    pluginModuleFederation({
      name: '{{ name }}',
{{#if isHost}}
      // Add remotes as they're generated, e.g.:
      // mfe1: 'mfe1@http://localhost:3001/static/js/mfe1.js'
      remotes: {},
{{else}}
      exposes: {
        './App': './src/App.tsx',
      },
{{/if}}
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
{{/if}}
  ],
});
