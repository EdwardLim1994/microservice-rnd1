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
      name: '{{ mfName }}',
      exposes: {
        './App': './src/App',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
      // Bun's npx doesn't auto-download packages; manage remote types manually via declare module
      dts: false,
    }),
  ],
  dev: {
    assetPrefix: `http://${process.env.{{ envVarName }}_HOST ?? 'localhost'}:{{ port }}`,
  },
  // dev.assetPrefix above only applies to `rsbuild dev` — it does nothing for `rsbuild build` +
  // `rsbuild preview` (the actual production path Dockerfile uses), which otherwise defaults to
  // a root-relative "/" publicPath baked into dist/mf-manifest.json. A consuming host then
  // resolves this remote's assets against *its own* origin, not this remote's — confirmed the
  // hard way on frontends/frontend1 (see its rsbuild.config.ts for the full story).
  // output.assetPrefix (unlike dev.assetPrefix) is what actually affects the production build's
  // baked publicPath. Uses {{ envVarName }}_PORT (not the hardcoded {{ port }} dev.assetPrefix
  // above still uses) since the production deployment's actual port varies — NodePort vs
  // `kubectl port-forward`.
  output: {
    assetPrefix: `http://${process.env.{{ envVarName }}_HOST ?? 'localhost'}:${process.env.{{ envVarName }}_PORT ?? {{ port }} }`,
  },
  server: {
    port: {{ port }},
    host: '0.0.0.0',
    cors: true,
  },
});
