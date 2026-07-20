import { afterEach, expect } from '@rstest/core';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

expect.extend(jestDomMatchers);

// @testing-library/react doesn't auto-register cleanup outside a Jest/Vitest global afterEach
// hook — without this, each test's rendered tree accumulates in the shared jsdom/happy-dom
// document, and data-testid queries start matching multiple elements across tests.
afterEach(cleanup);
