import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LogoutButton } from '../src/components/LogoutButton';
import { LOGOUT_MUTATION } from '../src/graphql/auth';
import { clearSession, getSession, setSession } from '../src/lib/session';

test('renders nothing when there is no active session', () => {
  clearSession();
  const { container } = render(
    <MockedProvider mocks={[]}>
      <LogoutButton />
    </MockedProvider>,
  );

  expect(container).toBeEmptyDOMElement();
});

test('clicking logout clears the session and calls onLogout', async () => {
  setSession({
    employeeId: 'emp-1',
    isSupervisor: false,
    accessToken: 'access-1',
  });
  const logoutMock = {
    request: { query: LOGOUT_MUTATION, variables: { accessToken: 'access-1' } },
    result: { data: { logout: { success: true, message: '' } } },
  };
  let called = false;

  render(
    <MockedProvider mocks={[logoutMock]}>
      <LogoutButton
        onLogout={() => {
          called = true;
        }}
      />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('logout-button'));

  await waitFor(() => expect(called).toBe(true));
  expect(getSession()).toBeNull();
});
