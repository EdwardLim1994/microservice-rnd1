import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: ['node 18'],
      dts: true,
    },
  ],
  output: {
    minify: true,
    externals: {
      // 'bun' is a runtime builtin, not an npm package — nothing to bundle, and only resolvable
      // when the built output actually runs under Bun (see RedisPlugin's dynamic import of it).
      bun: 'module bun',
      // @confluentinc/schemaregistry's index.js unconditionally requires every optional
      // encryption-rule driver (AWS KMS, GCP KMS, etc.) even though SchemaRegistryKafkaSerializer
      // only uses plain ProtobufSerializer/ProtobufDeserializer. Bundling that whole chain (GCP
      // KMS -> google-gax -> readable-stream) breaks at runtime: readable-stream's
      // util.inherits(Readable, Stream) throws "superCtor.prototype must be of type object,
      // received undefined" — Rspack's bundling of that chain's require('stream') doesn't resolve
      // Node's core `stream` module the way readable-stream expects. Marking it external instead
      // resolves it from the consuming server's own node_modules at runtime (real Node/Bun module
      // resolution, not Rspack's), which sidesteps the bundling bug entirely — consuming servers
      // must have @confluentinc/schemaregistry as a direct dependency (see servers/demo1/CLAUDE.md
      // and servers/demo2/CLAUDE.md).
      '@confluentinc/schemaregistry': 'module @confluentinc/schemaregistry',
      // @grpc/grpc-js pulls in the same readable-stream chain as @confluentinc/schemaregistry
      // above (its client/server call wrappers extend Node's stream classes) — bundling it hits
      // the identical "superCtor.prototype must be of type object, received undefined" crash,
      // and since GrpcDriver is part of this package's shared barrel, every consuming server's
      // dist bundles it regardless of whether that server actually uses gRPC (confirmed:
      // servers/auth, which is GraphQL-only, failed with this exact error under rstest before
      // this fix). Same externalization fix, same reasoning — every server generated via `turbo
      // gen driver` (grpc extension) already gets `@grpc/grpc-js` as a direct dependency; a
      // GraphQL-only server relies on Bun's workspace hoisting to still resolve it as a
      // transitive presence in node_modules.
      '@grpc/grpc-js': 'module @grpc/grpc-js',
      // Same readable-stream-under-Rspack crash again, this time via minio's own
      // block-stream2 dependency (used internally for multipart upload chunking) — see the
      // @confluentinc/schemaregistry comment above for the exact error and root cause. Every
      // server using MinioPlugin already has `minio` as a direct dependency (see
      // packages/server/CLAUDE.md's Plugins section), so externalizing it here is safe the same
      // way.
      minio: 'module minio',
    },
  },
});
