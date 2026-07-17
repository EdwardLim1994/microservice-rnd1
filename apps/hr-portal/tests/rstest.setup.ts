import { afterEach, expect } from '@rstest/core';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

expect.extend(jestDomMatchers);

// Testing Library doesn't auto-unmount between tests under rstest the way it does under
// Jest/Vitest (no framework-specific auto-cleanup registered) — without this, every test in a
// file renders on top of the previous one's still-mounted DOM, so `getByTestId` starts throwing
// "Found multiple elements" from the second test onward.
afterEach(() => {
  cleanup();
});
