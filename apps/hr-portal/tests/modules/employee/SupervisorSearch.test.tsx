import { expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { SupervisorSearch } from '../../../src/modules/employee/components/SupervisorSearch';
import type { Employee } from '../../../src/modules/employee/types/repository';

const employees: Employee[] = [
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
    supervisor: null,
  },
];

test('filters options by the search text in real time', () => {
  render(
    <SupervisorSearch
      employees={employees}
      search="jan"
      selectedId={null}
      onSearchChange={() => {}}
      onSelect={() => {}}
      testIdPrefix="test-supervisor"
    />,
  );

  expect(
    screen.getByTestId('test-supervisor-option-emp-1'),
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId('test-supervisor-option-emp-2'),
  ).not.toBeInTheDocument();
});

test('excludes the given excludeId from the options', () => {
  render(
    <SupervisorSearch
      employees={employees}
      excludeId="emp-1"
      search=""
      selectedId={null}
      onSearchChange={() => {}}
      onSelect={() => {}}
      testIdPrefix="test-supervisor"
    />,
  );

  expect(
    screen.queryByTestId('test-supervisor-option-emp-1'),
  ).not.toBeInTheDocument();
  expect(
    screen.getByTestId('test-supervisor-option-emp-2'),
  ).toBeInTheDocument();
});

test('highlights the selected supervisor and shows its name below', () => {
  render(
    <SupervisorSearch
      employees={employees}
      search=""
      selectedId="emp-2"
      onSearchChange={() => {}}
      onSelect={() => {}}
      testIdPrefix="test-supervisor"
    />,
  );

  expect(screen.getByTestId('test-supervisor-option-emp-2')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getAllByText('John Smith')).toHaveLength(2);
});

test('calls onSelect when an option is clicked, and onSearchChange when typing', () => {
  let selected: Employee | undefined;
  let searched: string | undefined;

  render(
    <SupervisorSearch
      employees={employees}
      search=""
      selectedId={null}
      onSearchChange={(value) => {
        searched = value;
      }}
      onSelect={(employee) => {
        selected = employee;
      }}
      testIdPrefix="test-supervisor"
    />,
  );

  fireEvent.change(screen.getByTestId('test-supervisor-search'), {
    target: { value: 'john' },
  });
  expect(searched).toBe('john');

  fireEvent.click(screen.getByTestId('test-supervisor-option-emp-2'));
  expect(selected).toEqual(employees[1]);
});
