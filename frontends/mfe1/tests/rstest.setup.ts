import { afterEach, beforeEach, expect } from '@rstest/core';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

expect.extend(jestDomMatchers);

// Not wired up by default under rstest (unlike Jest/Vitest, which auto-cleanup via their own
// testing-library integration) — without this, every test's rendered DOM accumulates in the same
// document, breaking any test file with more than one `render()` call across multiple tests.
afterEach(() => {
  cleanup();
});

// rstest's DOM environment provides `window`/`document`, but not `localStorage` (confirmed
// empirically: `typeof localStorage` is 'undefined' otherwise) — the `logout` module is the first
// one in this project to touch it in a test. Minimal in-memory Storage stand-in, reset before
// every test so state doesn't leak across tests the way a real browser's localStorage would.
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
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (globalThis.localStorage === undefined) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
  });
}

beforeEach(() => {
  globalThis.localStorage.clear();
});
