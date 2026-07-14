import { afterEach, expect } from '@rstest/core';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

expect.extend(jestDomMatchers);

// Not wired up by default under rstest (unlike Jest/Vitest, which auto-cleanup via their own
// testing-library integration) — without this, every test's rendered DOM accumulates in the same
// document, breaking any test file with more than one `render()` call across multiple tests.
afterEach(() => {
  cleanup();
});
