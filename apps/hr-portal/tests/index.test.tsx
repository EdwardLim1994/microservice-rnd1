import { expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', () => {
  const testMessage = 'hr-portal';
  render(<App />);
  expect(screen.getByText(testMessage)).toBeInTheDocument();
});

test('opens the Register Employee modal from the top-level button', () => {
  render(<App />);

  expect(
    screen.queryByTestId('register-employee-modal'),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('open-register-employee-modal'));

  expect(screen.getByTestId('register-employee-modal')).toBeInTheDocument();
  // Closing only happens via Done on the post-submit success screen, which needs a mocked
  // mutation — already covered by RegisterEmployeeModal.test.tsx's own success/Done test with a
  // MockedProvider, not duplicated here.
});
