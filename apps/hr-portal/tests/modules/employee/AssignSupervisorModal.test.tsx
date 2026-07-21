import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssignSupervisorModal } from '../../../src/modules/employee/components/AssignSupervisorModal';
import {
  ASSIGN_SUPERVISOR_MUTATION,
  EMPLOYEES_QUERY,
} from '../../../src/modules/employee/types/repository';

const employees = [
  {
    id: 'emp-1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    grossSalary: 72000,
    supervisor: null,
  },
  {
    id: 'sup-1',
    firstName: 'Morgan',
    lastName: 'Blake',
    email: 'morgan.blake@example.com',
    grossSalary: 98000,
    supervisor: null,
  },
];

test('submit is disabled until a supervisor is selected', () => {
  render(
    <MockedProvider mocks={[]}>
      <AssignSupervisorModal
        employeeId="emp-1"
        employees={employees}
        onClose={() => {}}
      />
    </MockedProvider>,
  );

  expect(
    screen.getByTestId('assign-supervisor-option-sup-1'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('assign-supervisor-submit')).toBeDisabled();

  fireEvent.click(screen.getByTestId('assign-supervisor-option-sup-1'));
  expect(screen.getByTestId('assign-supervisor-submit')).not.toBeDisabled();
});

test('excludes the employee itself from the supervisor options', () => {
  render(
    <MockedProvider mocks={[]}>
      <AssignSupervisorModal
        employeeId="emp-1"
        employees={employees}
        onClose={() => {}}
      />
    </MockedProvider>,
  );

  expect(
    screen.queryByTestId('assign-supervisor-option-emp-1'),
  ).not.toBeInTheDocument();
  expect(
    screen.getByTestId('assign-supervisor-option-sup-1'),
  ).toBeInTheDocument();
});

test('clearing the search text after selecting a supervisor clears the selection too', () => {
  render(
    <MockedProvider mocks={[]}>
      <AssignSupervisorModal
        employeeId="emp-1"
        employees={employees}
        onClose={() => {}}
      />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('assign-supervisor-option-sup-1'));
  expect(screen.getByTestId('assign-supervisor-submit')).not.toBeDisabled();

  fireEvent.change(screen.getByTestId('assign-supervisor-search'), {
    target: { value: '' },
  });

  expect(screen.getByTestId('assign-supervisor-submit')).toBeDisabled();
});

test('submits the assignment and closes on success', async () => {
  let closed = false;
  const mocks = [
    {
      request: {
        query: ASSIGN_SUPERVISOR_MUTATION,
        variables: { employeeId: 'emp-1', supervisorId: 'sup-1' },
      },
      result: {
        data: {
          assignSupervisor: {
            id: 'emp-1',
            supervisor: { id: 'sup-1', firstName: 'Morgan', lastName: 'Blake' },
          },
        },
      },
    },
    // awaitRefetchQueries: true (useAssignSupervisor.ts) means the mutation promise doesn't
    // resolve until this refetch also resolves.
    { request: { query: EMPLOYEES_QUERY }, result: { data: { employees } } },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <AssignSupervisorModal
        employeeId="emp-1"
        employees={employees}
        onClose={() => {
          closed = true;
        }}
      />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('assign-supervisor-option-sup-1'));
  fireEvent.click(screen.getByTestId('assign-supervisor-submit'));

  await waitFor(() => {
    expect(closed).toBe(true);
  });
});

test('shows an error toast when the assignment is rejected as ineligible', async () => {
  const mocks = [
    {
      request: {
        query: ASSIGN_SUPERVISOR_MUTATION,
        variables: { employeeId: 'emp-1', supervisorId: 'sup-1' },
      },
      error: new Error('Target has served fewer than 5 years'),
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <AssignSupervisorModal
        employeeId="emp-1"
        employees={employees}
        onClose={() => {}}
      />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('assign-supervisor-option-sup-1'));
  fireEvent.click(screen.getByTestId('assign-supervisor-submit'));

  await waitFor(() => {
    expect(screen.getByTestId('toast-error')).toHaveTextContent(
      'Target has served fewer than 5 years',
    );
  });
  expect(screen.getByTestId('assign-supervisor-modal')).toBeInTheDocument();
});

test('close button calls onClose', () => {
  let closed = false;
  render(
    <MockedProvider mocks={[]}>
      <AssignSupervisorModal
        employeeId="emp-1"
        employees={employees}
        onClose={() => {
          closed = true;
        }}
      />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('assign-supervisor-close'));
  expect(closed).toBe(true);
});
