import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { AppShell } from '../src/AppShell';
import { EMPLOYEES_QUERY } from '../src/modules/employee/types/repository';

function employeesQueryMock() {
  return {
    request: { query: EMPLOYEES_QUERY },
    result: { data: { employees: [] } },
  };
}

test('renders LoginPage when signed out', () => {
  render(
    <MockedProvider mocks={[]}>
      <AppShell session={{ status: 'signed-out' }} onSignedIn={() => {}} />
    </MockedProvider>,
  );
  expect(screen.getByTestId('login-page')).toBeInTheDocument();
});

test('renders the must-change-password placeholder', () => {
  render(
    <MockedProvider mocks={[]}>
      <AppShell
        session={{ status: 'must-change-password' }}
        onSignedIn={() => {}}
      />
    </MockedProvider>,
  );
  expect(
    screen.getByTestId('must-change-password-placeholder'),
  ).toBeInTheDocument();
});

test('renders HrAdminHome for the hr-admin role', () => {
  render(
    <MockedProvider mocks={[employeesQueryMock()]}>
      <AppShell
        session={{ status: 'signed-in', role: 'hr-admin' }}
        onSignedIn={() => {}}
      />
    </MockedProvider>,
  );
  expect(screen.getByText('hr-portal')).toBeInTheDocument();
});

test('renders the dashboard placeholder for the supervisor role', () => {
  render(
    <MockedProvider mocks={[]}>
      <AppShell
        session={{ status: 'signed-in', role: 'supervisor' }}
        onSignedIn={() => {}}
      />
    </MockedProvider>,
  );
  expect(screen.getByTestId('dashboard-placeholder')).toBeInTheDocument();
});

test('renders the dashboard placeholder for the employee role', () => {
  render(
    <MockedProvider mocks={[]}>
      <AppShell
        session={{ status: 'signed-in', role: 'employee' }}
        onSignedIn={() => {}}
      />
    </MockedProvider>,
  );
  expect(screen.getByTestId('dashboard-placeholder')).toBeInTheDocument();
});
