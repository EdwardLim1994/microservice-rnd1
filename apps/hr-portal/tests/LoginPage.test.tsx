import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
import { LoginPage } from '../src/components/LoginPage';
import { EMPLOYEES_FOR_LOGIN_QUERY, LOGIN_MUTATION } from '../src/graphql/auth';
import { clearSession, getSession } from '../src/lib/session';

const loginMock = {
  request: {
    query: LOGIN_MUTATION,
    variables: {
      email: 'EMP-002@employees.local',
      password: 'correct-password',
    },
  },
  result: {
    data: {
      login: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        idToken: 'id-1',
      },
    },
  },
};

const employeesMock = {
  request: { query: EMPLOYEES_FOR_LOGIN_QUERY },
  result: {
    data: {
      employees: [
        { id: 'emp-uuid-1', employeeId: 'EMP-001', supervisor: null },
        {
          id: 'emp-uuid-2',
          employeeId: 'EMP-002',
          supervisor: { id: 'emp-uuid-1' },
        },
      ],
    },
  },
};

function fillForm(
  email = 'EMP-001@employees.local',
  password = 'correct-password',
) {
  fireEvent.change(screen.getByTestId('email-input'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByTestId('password-input'), {
    target: { value: password },
  });
}

test('INT-16-1: valid login establishes a session (employeeId, isSupervisor) and calls onLoginSuccess', async () => {
  clearSession();
  const onLoginSuccess = () => {
    called = true;
  };
  let called = false;

  render(
    <MockedProvider mocks={[loginMock, employeesMock]}>
      <LoginPage onLoginSuccess={onLoginSuccess} />
    </MockedProvider>,
  );

  fillForm('EMP-002@employees.local', 'correct-password');
  fireEvent.click(screen.getByTestId('login-button'));

  await waitFor(() => expect(called).toBe(true));
  const session = getSession();
  expect(session?.employeeId).toBe('emp-uuid-2');
  expect(session?.isSupervisor).toBe(false);
});

test('determines isSupervisor: true when other employees report to the logged-in employee', async () => {
  clearSession();
  let called = false;
  const supervisorLoginMock = {
    request: {
      query: LOGIN_MUTATION,
      variables: {
        email: 'EMP-001@employees.local',
        password: 'correct-password',
      },
    },
    result: {
      data: {
        login: {
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          idToken: 'id-1',
        },
      },
    },
  };

  render(
    <MockedProvider mocks={[supervisorLoginMock, employeesMock]}>
      <LoginPage
        onLoginSuccess={() => {
          called = true;
        }}
      />
    </MockedProvider>,
  );

  fillForm();
  fireEvent.click(screen.getByTestId('login-button'));

  await waitFor(() => expect(called).toBe(true));
  expect(getSession()?.isSupervisor).toBe(true);
});

// [INT-16-2] Invalid credentials shows an inline error, no session established
test('invalid credentials shows an inline error and does not establish a session', async () => {
  clearSession();
  const invalidCredentialsMock = {
    request: {
      query: LOGIN_MUTATION,
      variables: {
        email: 'EMP-001@employees.local',
        password: 'wrong-password',
      },
    },
    result: {
      errors: [
        new GraphQLError('Invalid email or password', {
          extensions: { code: 'INVALID_CREDENTIALS' },
        }),
      ],
    },
  };

  render(
    <MockedProvider mocks={[invalidCredentialsMock]}>
      <LoginPage />
    </MockedProvider>,
  );

  fillForm('EMP-001@employees.local', 'wrong-password');
  fireEvent.click(screen.getByTestId('login-button'));

  await waitFor(() => {
    expect(screen.getByTestId('credentials-error')).toBeInTheDocument();
  });
  expect(getSession()).toBeNull();
});

test('Authentik unreachable shows a generic error banner', async () => {
  clearSession();
  const unreachableMock = {
    request: {
      query: LOGIN_MUTATION,
      variables: {
        email: 'EMP-001@employees.local',
        password: 'correct-password',
      },
    },
    error: new Error('Network error'),
  };

  render(
    <MockedProvider mocks={[unreachableMock]}>
      <LoginPage />
    </MockedProvider>,
  );

  fillForm();
  fireEvent.click(screen.getByTestId('login-button'));

  await waitFor(() => {
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
  });
});

test('no matching employee record shows a banner error and does not establish a session', async () => {
  clearSession();
  const unmatchedLoginMock = {
    request: {
      query: LOGIN_MUTATION,
      variables: {
        email: 'EMP-999@employees.local',
        password: 'correct-password',
      },
    },
    result: {
      data: {
        login: {
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          idToken: 'id-1',
        },
      },
    },
  };

  render(
    <MockedProvider mocks={[unmatchedLoginMock, employeesMock]}>
      <LoginPage />
    </MockedProvider>,
  );

  fillForm('EMP-999@employees.local', 'correct-password');
  fireEvent.click(screen.getByTestId('login-button'));

  await waitFor(() => {
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
  });
  expect(getSession()).toBeNull();
});
