import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: ['node 18'],
      dts: true,
      source: { entry: { index: './src/index.ts' } },
    },
    {
      // Its own build entry, deliberately not re-exported from the main "." entry (src/index.ts)
      // — see otel-bootstrap.ts's own docs for why importing it through the main bundle (which
      // also pulls in ApolloDriver.ts/GrpcDriver.ts's own `graphql`/`@grpc/grpc-js` imports)
      // defeats the whole point of calling it before those modules ever load.
      format: 'esm',
      syntax: ['node 18'],
      dts: true,
      source: { entry: { 'otel-bootstrap': './src/otel-bootstrap.ts' } },
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
    },
  },
});
