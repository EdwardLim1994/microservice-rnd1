import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { render, screen, waitFor } from '@testing-library/react';
import { EmployeesPage } from '../../../src/modules/employee/pages/EmployeesPage';
import { EMPLOYEES_QUERY } from '../../../src/modules/employee/types/repository';

test('shows the loading state before data arrives', () => {
  render(
    <MockedProvider mocks={[]}>
      <EmployeesPage />
    </MockedProvider>,
  );

  expect(screen.getByTestId('employees-loading')).toBeInTheDocument();
});

test('renders an empty table body without error when there are no employees', async () => {
  const mocks = [
    {
      request: { query: EMPLOYEES_QUERY },
      result: { data: { employees: [] } },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <EmployeesPage />
    </MockedProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('employees-empty')).toBeInTheDocument();
  });
});

test('renders employee rows with supervisor resolved and an em dash when none is assigned', async () => {
  const mocks = [
    {
      request: { query: EMPLOYEES_QUERY },
      result: {
        data: {
          employees: [
            {
              id: 'emp-1',
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane.doe@example.com',
              grossSalary: 72000,
              supervisor: null,
            },
            {
              id: 'emp-2',
              firstName: 'John',
              lastName: 'Smith',
              email: 'john.smith@example.com',
              grossSalary: 68000,
              supervisor: { id: 'emp-1', firstName: 'Jane', lastName: 'Doe' },
            },
          ],
        },
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <EmployeesPage />
    </MockedProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('employee-row-emp-1')).toBeInTheDocument();
  });

  expect(screen.getByTestId('employee-row-emp-1')).toHaveTextContent('$72,000');
  expect(screen.getByTestId('employee-row-emp-1')).toHaveTextContent('—');
  expect(screen.getByTestId('employee-row-emp-2')).toHaveTextContent(
    'Jane Doe',
  );
});

test('shows the error message when the employees query fails', async () => {
  const mocks = [
    {
      request: { query: EMPLOYEES_QUERY },
      error: new Error('Failed to fetch employees'),
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <EmployeesPage />
    </MockedProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('employees-error')).toBeInTheDocument();
  });
});
