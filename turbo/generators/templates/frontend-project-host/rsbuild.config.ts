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
      // Add remotes here as they're created, e.g.:
      // shop: `shop@http://${process.env.SHOP_HOST ?? 'localhost'}:${process.env.SHOP_PORT ?? 3002}/mf-manifest.json`,
      //
      // This is resolved by the BROWSER at runtime (Module Federation fetches a remote's
      // manifest client-side, not server-side) — process.env.SHOP_HOST/SHOP_PORT get inlined
      // into this host's own bundle at *image build* time by Rsbuild (same mechanism as
      // PUBLIC_GRAPHQL_URL — see frontends/frontend1/terraform/CLAUDE.md), so whatever value was
      // set via `docker build --build-arg SHOP_HOST=... --build-arg SHOP_PORT=...` is what every
      // browser loading this host gets. For a k8s-deployed remote reachable via minikube (see
      // that remote's own helm/values.yaml — NodePort, not ClusterIP, since a browser needs to
      // reach it directly): SHOP_HOST is `minikube ip`'s output, SHOP_PORT is that remote's
      // assigned nodePort — NOT its dev port (3002 above), which is only the *container's*
      // internal port, unreachable from outside the cluster.
      remotes: {},
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
      // Bun's npx doesn't auto-download packages; manage remote types manually via declare module
      dts: false,
    }),
  ],
  server: {
    port: {{ port }},
    host: '0.0.0.0',
  },
});
