import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: ['node 18'],
      dts: true,
      // Root cause of a whole class of "readable-stream/util.inherits: superCtor.prototype must
      // be of type object" crashes (previously worked around one dependency at a time — see git
      // history for the @confluentinc/schemaregistry-only externals entry this replaced): every
      // heavy runtime dependency here (@grpc/grpc-js, @apollo/server, @confluentinc/schemaregistry,
      // kafkajs, graphql, ...) is deliberately kept as a devDependency, not a dependency, of this
      // package (see this file's own Dependencies section in CLAUDE.md — consuming servers
      // provide the real version as their own direct dependency). Rslib's `autoExternal` only
      // externalizes real `dependencies`/`peerDependencies`/`optionalDependencies` by default
      // (`devDependencies: false`), so all of those were being bundled wholesale, each dragging in
      // its own (sometimes duplicated, incompatible) copy of transitive chains like
      // readable-stream. Externalizing devDependencies too fixes this at the source instead of
      // chasing one bundled chain at a time.
      autoExternal: { devDependencies: true },
    },
  ],
  output: {
    minify: true,
    externals: {
      // 'bun' is a runtime builtin, not an npm package — nothing to bundle, and only resolvable
      // when the built output actually runs under Bun (see RedisPlugin's dynamic import of it).
      // Not caught by the devDependencies autoExternal above since 'bun' isn't a real npm package
      // in this package.json at all.
      bun: 'module bun',
    },
  },
});
