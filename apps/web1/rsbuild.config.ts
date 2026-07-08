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
      name: 'web1',
      // This is resolved by the BROWSER at runtime (Module Federation fetches a remote's
      // manifest client-side, not server-side) — process.env.MFE1_HOST gets inlined into this
      // host's own bundle at *image build* time by Rsbuild (same mechanism as
      // PUBLIC_GRAPHQL_URL — see frontends/frontend1/terraform/CLAUDE.md), so whatever value was
      // set via `docker build --build-arg MFE1_HOST=...` is what every browser loading this host
      // gets. The port (3001) is mfe1's own dev port, hardcoded here rather than read from
      // MFE1_PORT — same convention apps/portal used for frontend1. For a k8s-deployed remote
      // reachable via minikube (see mfe1's own helm/values.yaml — NodePort, not ClusterIP, since
      // a browser needs to reach it directly): MFE1_HOST is `minikube ip`'s output, and this
      // hardcoded 3001 would need to become mfe1's assigned nodePort instead — not its dev port,
      // which is only the *container's* internal port, unreachable from outside the cluster.
      remotes: {
        mfe1: `mfe1@http://${process.env.MFE1_HOST ?? 'localhost'}:3001/mf-manifest.json`,
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
