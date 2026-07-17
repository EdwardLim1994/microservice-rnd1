import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ForgotPasswordPage } from '../src/components/ForgotPasswordPage';
import { REQUEST_PASSWORD_RESET_MUTATION } from '../src/graphql/passwordReset';

// [INT-14-1] Valid email submission shows success message regardless of account existence
test('valid email submission shows the success message', async () => {
  const requestMock = {
    request: {
      query: REQUEST_PASSWORD_RESET_MUTATION,
      variables: { input: { email: 'user@example.com' } },
    },
    result: { data: { requestPasswordReset: { success: true } } },
  };

  render(
    <MockedProvider mocks={[requestMock]}>
      <ForgotPasswordPage />
    </MockedProvider>,
  );

  fireEvent.change(screen.getByTestId('email-input'), {
    target: { value: 'user@example.com' },
  });
  fireEvent.click(screen.getByTestId('send-reset-link-button'));

  await waitFor(() => {
    expect(screen.getByTestId('reset-request-success')).toHaveTextContent(
      'a reset link has been sent',
    );
  });
});

// Edge case: invalid email format
test('shows inline validation for an invalid email format', () => {
  render(
    <MockedProvider mocks={[]}>
      <ForgotPasswordPage />
    </MockedProvider>,
  );

  fireEvent.change(screen.getByTestId('email-input'), {
    target: { value: 'not-an-email' },
  });
  fireEvent.click(screen.getByTestId('send-reset-link-button'));

  expect(screen.getByTestId('email-format-error')).toBeInTheDocument();
});

// Edge case: Authentik unreachable
test('shows a generic error banner on network failure', async () => {
  const failedMock = {
    request: {
      query: REQUEST_PASSWORD_RESET_MUTATION,
      variables: { input: { email: 'user@example.com' } },
    },
    error: new Error('Network error'),
  };

  render(
    <MockedProvider mocks={[failedMock]}>
      <ForgotPasswordPage />
    </MockedProvider>,
  );

  fireEvent.change(screen.getByTestId('email-input'), {
    target: { value: 'user@example.com' },
  });
  fireEvent.click(screen.getByTestId('send-reset-link-button'));

  await waitFor(() => {
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
  });
});
