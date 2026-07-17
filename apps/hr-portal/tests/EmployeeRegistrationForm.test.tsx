import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
import { EmployeeRegistrationForm } from '../src/components/EmployeeRegistrationForm';
import {
  EMPLOYEES_QUERY,
  REGISTER_EMPLOYEE_MUTATION,
} from '../src/graphql/employee';

const emptyEmployeesMock = {
  request: { query: EMPLOYEES_QUERY },
  result: { data: { employees: [] } },
};

function fillRequiredFields() {
  fireEvent.change(screen.getByTestId('fullName-input'), {
    target: { value: 'Ada Lovelace' },
  });
  fireEvent.change(screen.getByTestId('employeeId-input'), {
    target: { value: 'EMP-001' },
  });
  fireEvent.change(screen.getByTestId('grossSalary-input'), {
    target: { value: '5000' },
  });
}

// FEAT-5 default state
test('shows the register button, no form, initially', () => {
  render(
    <MockedProvider mocks={[emptyEmployeesMock]}>
      <EmployeeRegistrationForm />
    </MockedProvider>,
  );

  expect(screen.getByTestId('register-employee-button')).toBeInTheDocument();
  expect(screen.queryByTestId('fullName-input')).not.toBeInTheDocument();
});

// Edge case: supervisor dropdown empty
test('shows "No supervisors available" when there are no employees yet', async () => {
  render(
    <MockedProvider mocks={[emptyEmployeesMock]}>
      <EmployeeRegistrationForm />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('register-employee-button'));

  await waitFor(() => {
    expect(screen.getByTestId('supervisor-dropdown')).toHaveTextContent(
      'No supervisors available',
    );
  });
});

// [INT-5-1] Valid submission displays the temporary password
test('valid submission shows the copyable temporary password on success', async () => {
  const registerMock = {
    request: {
      query: REGISTER_EMPLOYEE_MUTATION,
      variables: {
        input: {
          fullName: 'Ada Lovelace',
          employeeId: 'EMP-001',
          role: 'Software Engineer',
          department: 'Engineering',
          grossSalary: 5000,
          supervisorId: null,
        },
      },
    },
    result: {
      data: {
        registerEmployee: {
          employee: {
            id: 'emp-1',
            fullName: 'Ada Lovelace',
            employeeId: 'EMP-001',
          },
          temporaryPassword: 'Tmp-abc123!',
        },
      },
    },
  };

  render(
    <MockedProvider
      mocks={[emptyEmployeesMock, registerMock, emptyEmployeesMock]}
    >
      <EmployeeRegistrationForm />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('register-employee-button'));
  await waitFor(() =>
    expect(screen.getByTestId('fullName-input')).toBeInTheDocument(),
  );
  fillRequiredFields();
  fireEvent.click(screen.getByTestId('submit-button'));

  await waitFor(() => {
    expect(screen.getByTestId('temporary-password-field')).toHaveValue(
      'Tmp-abc123!',
    );
  });
});

// [INT-5-2] Duplicate employeeId shows inline error
test('duplicate employeeId shows an inline error on the employeeId field', async () => {
  const conflictMock = {
    request: {
      query: REGISTER_EMPLOYEE_MUTATION,
      variables: {
        input: {
          fullName: 'Ada Lovelace',
          employeeId: 'EMP-001',
          role: 'Software Engineer',
          department: 'Engineering',
          grossSalary: 5000,
          supervisorId: null,
        },
      },
    },
    result: {
      errors: [
        new GraphQLError('conflict', { extensions: { code: 'CONFLICT' } }),
      ],
    },
  };

  render(
    <MockedProvider mocks={[emptyEmployeesMock, conflictMock]}>
      <EmployeeRegistrationForm />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('register-employee-button'));
  await waitFor(() =>
    expect(screen.getByTestId('fullName-input')).toBeInTheDocument(),
  );
  fillRequiredFields();
  fireEvent.click(screen.getByTestId('submit-button'));

  await waitFor(() => {
    expect(screen.getByTestId('employeeId-error')).toBeInTheDocument();
  });
});

// [INT-5-3] Network failure shows an error banner and preserves form state
test('network failure shows an error banner and keeps the entered values', async () => {
  const networkErrorMock = {
    request: {
      query: REGISTER_EMPLOYEE_MUTATION,
      variables: {
        input: {
          fullName: 'Ada Lovelace',
          employeeId: 'EMP-001',
          role: 'Software Engineer',
          department: 'Engineering',
          grossSalary: 5000,
          supervisorId: null,
        },
      },
    },
    error: new Error('Network error'),
  };

  render(
    <MockedProvider mocks={[emptyEmployeesMock, networkErrorMock]}>
      <EmployeeRegistrationForm />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('register-employee-button'));
  await waitFor(() =>
    expect(screen.getByTestId('fullName-input')).toBeInTheDocument(),
  );
  fillRequiredFields();
  fireEvent.click(screen.getByTestId('submit-button'));

  await waitFor(() => {
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
  });
  expect(screen.getByTestId('fullName-input')).toHaveValue('Ada Lovelace');
});
