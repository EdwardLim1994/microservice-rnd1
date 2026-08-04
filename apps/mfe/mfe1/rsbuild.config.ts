import { defineConfig } from '@rsbuild/core';
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
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
    }),
  ],
});
