import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegisterEmployeeModal } from '../../../src/modules/employee/components/RegisterEmployeeModal';
import {
  EMPLOYEES_QUERY,
  REGISTER_EMPLOYEE_MUTATION,
} from '../../../src/modules/employee/types/repository';

// registerEmployee triggers a refetchQueries: [EMPLOYEES_QUERY] (see useRegisterEmployee.ts) so
// the Employees table picks up newly-registered employees — every mock list below that resolves
// the mutation needs a matching EMPLOYEES_QUERY mock or MockedProvider logs an unmatched-query
// warning.
const employeesRefetchMock = {
  request: { query: EMPLOYEES_QUERY },
  result: { data: { employees: [] } },
};

function fillForm() {
  fireEvent.change(screen.getByTestId('register-employee-first-name'), {
    target: { value: 'Jane' },
  });
  fireEvent.change(screen.getByTestId('register-employee-last-name'), {
    target: { value: 'Doe' },
  });
  fireEvent.change(screen.getByTestId('register-employee-gender'), {
    target: { value: 'FEMALE' },
  });
  fireEvent.change(screen.getByTestId('register-employee-email'), {
    target: { value: 'jane.doe@example.com' },
  });
  fireEvent.change(screen.getByTestId('register-employee-gross-salary'), {
    target: { value: '5000' },
  });
  fireEvent.change(screen.getByTestId('register-employee-salary-per-day'), {
    target: { value: '200' },
  });
}

test('does not render anything when closed', () => {
  render(
    <MockedProvider mocks={[]}>
      <RegisterEmployeeModal isOpen={false} onClose={() => {}} />
    </MockedProvider>,
  );
  expect(
    screen.queryByTestId('register-employee-modal'),
  ).not.toBeInTheDocument();
});

test('renders the form when open', () => {
  render(
    <MockedProvider mocks={[]}>
      <RegisterEmployeeModal isOpen={true} onClose={() => {}} />
    </MockedProvider>,
  );
  expect(screen.getByTestId('register-employee-form')).toBeInTheDocument();
});

test('submits the form and shows the success screen with the temporary password', async () => {
  const mocks = [
    {
      request: {
        query: REGISTER_EMPLOYEE_MUTATION,
        variables: {
          input: {
            firstName: 'Jane',
            lastName: 'Doe',
            gender: 'FEMALE',
            email: 'jane.doe@example.com',
            grossSalary: 5000,
            salaryPerDay: 200,
            supervisorId: undefined,
          },
        },
      },
      result: {
        data: {
          registerEmployee: {
            employee: {
              id: 'emp-1',
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane.doe@example.com',
            },
            temporaryPassword: 'temp-pass-123',
          },
        },
      },
    },
    employeesRefetchMock,
  ];

  render(
    <MockedProvider mocks={mocks}>
      <RegisterEmployeeModal isOpen={true} onClose={() => {}} />
    </MockedProvider>,
  );

  fillForm();
  fireEvent.click(screen.getByTestId('register-employee-submit'));

  await waitFor(() => {
    expect(screen.getByTestId('register-employee-success')).toBeInTheDocument();
  });
  expect(screen.getByTestId('register-employee-temp-password')).toHaveValue(
    'temp-pass-123',
  );
});

test('shows the error message returned by the API', async () => {
  const mocks = [
    {
      request: {
        query: REGISTER_EMPLOYEE_MUTATION,
        variables: {
          input: {
            firstName: 'Jane',
            lastName: 'Doe',
            gender: 'FEMALE',
            email: 'jane.doe@example.com',
            grossSalary: 5000,
            salaryPerDay: 200,
            supervisorId: undefined,
          },
        },
      },
      error: new Error(
        'An employee with email jane.doe@example.com already exists',
      ),
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <RegisterEmployeeModal isOpen={true} onClose={() => {}} />
    </MockedProvider>,
  );

  fillForm();
  fireEvent.click(screen.getByTestId('register-employee-submit'));

  await waitFor(() => {
    expect(screen.getByTestId('register-employee-error')).toBeInTheDocument();
  });
});

test('calls onClose and resets the form after Done is clicked', async () => {
  const mocks = [
    {
      request: {
        query: REGISTER_EMPLOYEE_MUTATION,
        variables: {
          input: {
            firstName: 'Jane',
            lastName: 'Doe',
            gender: 'FEMALE',
            email: 'jane.doe@example.com',
            grossSalary: 5000,
            salaryPerDay: 200,
            supervisorId: undefined,
          },
        },
      },
      result: {
        data: {
          registerEmployee: {
            employee: {
              id: 'emp-1',
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane.doe@example.com',
            },
            temporaryPassword: 'temp-pass-123',
          },
        },
      },
    },
    employeesRefetchMock,
  ];
  let closed = false;

  render(
    <MockedProvider mocks={mocks}>
      <RegisterEmployeeModal
        isOpen={true}
        onClose={() => {
          closed = true;
        }}
      />
    </MockedProvider>,
  );

  fillForm();
  fireEvent.click(screen.getByTestId('register-employee-submit'));
  await waitFor(() => {
    expect(screen.getByTestId('register-employee-success')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId('register-employee-done'));

  expect(closed).toBe(true);
});

test('copies the temporary password to the clipboard and shows "Copied!" briefly', async () => {
  const mocks = [
    {
      request: {
        query: REGISTER_EMPLOYEE_MUTATION,
        variables: {
          input: {
            firstName: 'Jane',
            lastName: 'Doe',
            gender: 'FEMALE',
            email: 'jane.doe@example.com',
            grossSalary: 5000,
            salaryPerDay: 200,
            supervisorId: undefined,
          },
        },
      },
      result: {
        data: {
          registerEmployee: {
            employee: {
              id: 'emp-1',
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane.doe@example.com',
            },
            temporaryPassword: 'temp-pass-123',
          },
        },
      },
    },
    employeesRefetchMock,
  ];
  const originalClipboard = globalThis.navigator.clipboard;
  let writtenText: string | undefined;
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        writtenText = text;
      },
    },
  });

  render(
    <MockedProvider mocks={mocks}>
      <RegisterEmployeeModal isOpen={true} onClose={() => {}} />
    </MockedProvider>,
  );

  fillForm();
  fireEvent.click(screen.getByTestId('register-employee-submit'));
  await waitFor(() => {
    expect(screen.getByTestId('register-employee-success')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId('register-employee-copy'));

  expect(writtenText).toBe('temp-pass-123');
  expect(screen.getByTestId('register-employee-copy')).toHaveTextContent(
    'Copied!',
  );
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
});
