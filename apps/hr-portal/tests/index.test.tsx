import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';
import { setSession } from '../src/lib/session';
import { router } from '../src/routes';

// `router` is a module-level singleton (imported once, shared across every test in this file) —
// each test navigates it back to '/' first so beforeLoad's session guard re-evaluates against
// that test's own localStorage state, instead of reusing whatever location the previous test's
// redirect left it at.
async function goToIndex() {
  await router.navigate({ to: '/' });
}

// [INT-16-3] Unauthenticated access to a protected route redirects to /login — the index route
// ('/') now requires a session (FEAT-16), so a logged-in-out visitor sees LoginPage instead.
test('redirects to /login when there is no active session', async () => {
  await goToIndex();
  render(<App />);
  expect(await screen.findByTestId('login-button')).toBeInTheDocument();
});

test('renders the main page once a session exists', async () => {
  setSession({
    employeeId: 'emp-1',
    isSupervisor: false,
    accessToken: 'access-1',
  });
  await goToIndex();
  const testMessage = 'hr-portal';
  render(<App />);
  // @tanstack/react-router resolves the initial route asynchronously — findByText retries
  // instead of asserting on the first (pre-router-resolution) paint.
  expect(await screen.findByText(testMessage)).toBeInTheDocument();
});
