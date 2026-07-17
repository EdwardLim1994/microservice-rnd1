import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';
import { clearSession, setSession } from '../src/lib/session';
import { router } from '../src/routes';

async function goTo(path: string) {
  try {
    await router.navigate({ to: path });
  } catch {
    // TanStack Router's beforeLoad redirect() rejects the navigate() promise itself — the
    // redirect still lands (RouterProvider handles it), this just silences the rejection here.
  }
}

// [INT-16-4] Employee (non-supervisor) navigates to /leave/approvals — redirected away
test('non-supervisor is redirected away from /leave/approvals', async () => {
  setSession({
    employeeId: 'emp-1',
    isSupervisor: false,
    accessToken: 'access-1',
  });
  await goTo('/leave/approvals');
  render(<App />);

  expect(await screen.findByText('hr-portal')).toBeInTheDocument();
});

test('supervisor can reach /leave/approvals', async () => {
  setSession({
    employeeId: 'emp-1',
    isSupervisor: true,
    accessToken: 'access-1',
  });
  await goTo('/leave/approvals');
  render(<App />);

  expect(await screen.findByText('Leave Approvals')).toBeInTheDocument();
});

test('unauthenticated access to /leave/approvals redirects to /login', async () => {
  clearSession();
  await goTo('/leave/approvals');
  render(<App />);

  expect(await screen.findByTestId('login-button')).toBeInTheDocument();
});
