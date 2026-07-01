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
    // 'bun' is a runtime builtin, not an npm package — nothing to bundle, and only resolvable
    // when the built output actually runs under Bun (see RedisPlugin's dynamic import of it).
    externals: {
      bun: 'module bun',
    },
  },
});
