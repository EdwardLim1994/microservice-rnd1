import { afterEach, expect } from '@rstest/core';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

expect.extend(jestDomMatchers);

// This DOM test environment doesn't provide `localStorage` (unlike a real browser or
// jsdom/happy-dom's own default config) — components/tests relying on it (session storage,
// FEAT-16) would otherwise see every read/write silently no-op via optional chaining. Minimal
// in-memory Storage polyfill, not module mocking.
if (typeof globalThis.localStorage === 'undefined') {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length() {
      return this.store.size;
    }
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.has(key) ? (this.store.get(key) as string) : null;
    }
    key(index: number) {
      return Array.from(this.store.keys())[index] ?? null;
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
    setItem(key: string, value: string) {
      this.store.set(key, String(value));
    }
  }
  globalThis.localStorage = new MemoryStorage();
}

afterEach(() => {
  globalThis.localStorage?.clear();
});

// Testing Library doesn't auto-unmount between tests under rstest the way it does under
// Jest/Vitest (no framework-specific auto-cleanup registered) — without this, every test in a
// file renders on top of the previous one's still-mounted DOM, so `getByTestId` starts throwing
// "Found multiple elements" from the second test onward.
afterEach(() => {
  cleanup();
});
