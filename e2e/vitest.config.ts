import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['api/**/*.test.ts'],
    environment: 'node',
    globals: true,
    // Vitest's 5000ms default is too tight for these tests: register/login/logout each drive a
    // real multi-step Authentik flow (identification -> password -> MFA-skip -> redirect ->
    // token exchange, see servers/auth/CLAUDE.md), and several tests chain two of those calls
    // (e.g. register then login) in sequence — confirmed ~1.9s + ~3.7s back to back, which alone
    // exceeds the default before the test body even runs its own assertions.
    testTimeout: 20000,
  },
})
