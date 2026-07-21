import { expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { ModalShell } from '../../../src/modules/employee/components/ModalShell';

test('renders children and calls onClose from the close button', () => {
  let closed = false;
  render(
    <ModalShell
      testId="test-modal"
      closeTestId="test-modal-close"
      onClose={() => {
        closed = true;
      }}
    >
      <p>content</p>
    </ModalShell>,
  );

  expect(screen.getByTestId('test-modal')).toBeInTheDocument();
  expect(screen.getByText('content')).toBeInTheDocument();

  fireEvent.click(screen.getByTestId('test-modal-close'));
  expect(closed).toBe(true);
});
