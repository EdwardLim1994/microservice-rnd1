import { withRsbuildConfig } from '@rstest/adapter-rsbuild';
import { defineConfig } from '@rstest/core';

// Docs: https://rstest.rs/config/
export default defineConfig({
  extends: withRsbuildConfig(),
  setupFiles: ['./tests/rstest.setup.ts'],
  // Same istanbul-lcov coverage setup as every server's own rstest.config.ts (see
  // packages/server/rstest.config.ts) — without this, Sonar has zero coverage data for this
  // app's code regardless of how well it's actually tested (confirmed the hard way on PR #206:
  // servers/employee shipped with no coverage.enabled here either, and its new_coverage gate
  // read 0% until both this config and sonar-project.properties's reportPaths were fixed).
  coverage: {
    enabled: true,
    provider: 'istanbul',
    reporters: ['text', 'lcov'],
    reportsDirectory: 'coverage',
  },
});
