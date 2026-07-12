import { afterEach, expect } from '@rstest/core';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

expect.extend(jestDomMatchers);

// Testing Library's own auto-cleanup registers via a global `afterEach` matching Jest/Vitest's
// convention, which rstest doesn't expose globally — without this, multiple render() calls
// across tests in the same file (or file) pile up in the document instead of being torn down
// between tests.
afterEach(cleanup);
