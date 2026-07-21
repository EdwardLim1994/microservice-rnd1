import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import { SIGN_IN_MUTATION } from '../src/modules/auth/types/repository';
import { EMPLOYEES_QUERY } from '../src/modules/employee/types/repository';

function makeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

test('renders the login page by default', () => {
  render(
    <MockedProvider mocks={[]}>
      <App />
    </MockedProvider>,
  );
  expect(screen.getByTestId('login-page')).toBeInTheDocument();
});

// Closes the gap AppShell.test.tsx/HrAdminHome.test.tsx leave open (they construct a `session`
// prop by hand or render in isolation) — this drives App's own handleSignedIn glue for real, by
// actually submitting the login form and letting the mutation response flow through
// deriveSession/setSession/AppShell.
test('signing in as an hr-admin routes through to HrAdminHome', async () => {
  const mocks = [
    {
      request: {
        query: SIGN_IN_MUTATION,
        variables: { email: 'admin@example.com', password: 'correct-password' },
      },
      result: {
        data: {
          signIn: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            idToken: makeJwt({ groups: ['hr-admin'] }),
            mustChangePassword: false,
          },
        },
      },
    },
    {
      request: { query: EMPLOYEES_QUERY },
      result: { data: { employees: [] } },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <App />
    </MockedProvider>,
  );

  fireEvent.change(screen.getByTestId('login-email'), {
    target: { value: 'admin@example.com' },
  });
  fireEvent.change(screen.getByTestId('login-password'), {
    target: { value: 'correct-password' },
  });
  fireEvent.click(screen.getByTestId('login-submit'));

  await waitFor(() => {
    expect(screen.getByText('hr-portal')).toBeInTheDocument();
  });
});
