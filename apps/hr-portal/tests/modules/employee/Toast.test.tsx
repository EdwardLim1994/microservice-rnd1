import { expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { Toast } from '../../../src/modules/employee/components/Toast';

test('renders the message and calls onDismiss when the dismiss button is clicked', () => {
  let dismissed = false;
  render(
    <Toast
      message="Something went wrong"
      onDismiss={() => {
        dismissed = true;
      }}
    />,
  );

  expect(screen.getByTestId('toast-error')).toHaveTextContent(
    'Something went wrong',
  );

  fireEvent.click(screen.getByTestId('toast-error-dismiss'));
  expect(dismissed).toBe(true);
});
