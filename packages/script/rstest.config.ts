import { withRslibConfig } from '@rstest/adapter-rslib';
import { defineConfig } from '@rstest/core';

export default defineConfig({
  extends: withRslibConfig(),
  coverage: {
    enabled: true,
    provider: 'istanbul',
    reporters: ['text', 'lcov'],
    reportsDirectory: 'coverage',
  },
});
