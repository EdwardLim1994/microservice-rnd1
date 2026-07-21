import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { HrAdminHome } from '../src/HrAdminHome';
import { EMPLOYEES_QUERY } from '../src/modules/employee/types/repository';

function employeesQueryMock() {
  return {
    request: { query: EMPLOYEES_QUERY },
    result: { data: { employees: [] } },
  };
}

test('renders the main page', () => {
  render(
    <MockedProvider mocks={[employeesQueryMock()]}>
      <HrAdminHome />
    </MockedProvider>,
  );
  expect(screen.getByText('hr-portal')).toBeInTheDocument();
});

test('opens the Register Employee modal from the top-level button', () => {
  render(
    // EmployeesPage's own mount-time query, plus RegisterEmployeeModal's own (skip: !isOpen)
    // query once opened below — two separate useEmployees() consumers, each needs its own mock.
    <MockedProvider mocks={[employeesQueryMock(), employeesQueryMock()]}>
      <HrAdminHome />
    </MockedProvider>,
  );

  expect(
    screen.queryByTestId('register-employee-modal'),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('open-register-employee-modal'));

  expect(screen.getByTestId('register-employee-modal')).toBeInTheDocument();
  // Closing only happens via Done on the post-submit success screen, which needs a mocked
  // mutation — already covered by RegisterEmployeeModal.test.tsx's own success/Done test with a
  // MockedProvider, not duplicated here.
});
