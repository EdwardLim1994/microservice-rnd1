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

// Bun 1.3.14 defines its own `globalThis.localStorage` (present per `'localStorage' in globalThis`,
// but reads back as `undefined`) — rstest's happy-dom environment setup (`installGlobal`) only
// overrides a global key with happy-dom's real implementation when that key is either in its
// hardcoded list or *absent* from `global` already; since Bun's own key already exists, happy-dom's
// working `window.localStorage`/`sessionStorage` never gets installed, and any code touching
// `window.localStorage` (e.g. `LoginPage`) throws on `.getItem`/`.setItem` being called on
// `undefined`. Standing up a minimal same-tab Storage polyfill here — real `localStorage` semantics
// (string-keyed, string values, no cross-test persistence needed) are all these tests require.
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

afterEach(() => {
  window.localStorage.clear();
});
