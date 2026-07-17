import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
import { SetPasswordPage } from '../src/components/SetPasswordPage';
import { CONFIRM_PASSWORD_RESET_MUTATION } from '../src/graphql/passwordReset';

function visitResetPasswordUrl(token = 'e2e-test-token') {
  window.history.pushState({}, '', `/reset-password?token=${token}`);
}

// [E2E-6] Password updated successfully
test('shows a success message and login link after a valid reset', async () => {
  visitResetPasswordUrl();
  const confirmMock = {
    request: {
      query: CONFIRM_PASSWORD_RESET_MUTATION,
      variables: {
        input: {
          resetToken: 'e2e-test-token',
          newPassword: 'Correct-Horse-Battery-1!',
        },
      },
    },
    result: { data: { confirmPasswordReset: { success: true } } },
  };

  render(
    <MockedProvider mocks={[confirmMock]}>
      <SetPasswordPage />
    </MockedProvider>,
  );

  fireEvent.change(screen.getByTestId('newPassword-input'), {
    target: { value: 'Correct-Horse-Battery-1!' },
  });
  fireEvent.change(screen.getByTestId('confirmPassword-input'), {
    target: { value: 'Correct-Horse-Battery-1!' },
  });
  fireEvent.click(screen.getByTestId('set-password-button'));

  await waitFor(() => {
    expect(screen.getByTestId('reset-confirm-success')).toHaveTextContent(
      'Password updated',
    );
  });
  expect(screen.getByTestId('login-link')).toBeInTheDocument();
});

// [INT-14-2] Mismatched passwords shows inline validation before submit
test('shows inline validation when passwords do not match on blur', () => {
  visitResetPasswordUrl();
  render(
    <MockedProvider mocks={[]}>
      <SetPasswordPage />
    </MockedProvider>,
  );

  fireEvent.change(screen.getByTestId('newPassword-input'), {
    target: { value: 'Correct-Horse-Battery-1!' },
  });
  fireEvent.change(screen.getByTestId('confirmPassword-input'), {
    target: { value: 'Different-Password-1!' },
  });
  fireEvent.blur(screen.getByTestId('confirmPassword-input'));

  expect(screen.getByTestId('password-mismatch-error')).toBeInTheDocument();
});

test('shows the Authentik policy error message returned from the API', async () => {
  visitResetPasswordUrl();
  const policyMock = {
    request: {
      query: CONFIRM_PASSWORD_RESET_MUTATION,
      variables: {
        input: { resetToken: 'e2e-test-token', newPassword: 'password' },
      },
    },
    result: {
      errors: [
        new GraphQLError('This password is too common.', {
          extensions: { code: 'PASSWORD_POLICY_VIOLATION' },
        }),
      ],
    },
  };

  render(
    <MockedProvider mocks={[policyMock]}>
      <SetPasswordPage />
    </MockedProvider>,
  );

  fireEvent.change(screen.getByTestId('newPassword-input'), {
    target: { value: 'password' },
  });
  fireEvent.change(screen.getByTestId('confirmPassword-input'), {
    target: { value: 'password' },
  });
  fireEvent.click(screen.getByTestId('set-password-button'));

  await waitFor(() => {
    expect(screen.getByTestId('policy-error')).toHaveTextContent('too common');
  });
});

// [INT-14-3] Expired token shows reset link expired message with back link
test('shows a reset link expired message for an invalid/expired token', async () => {
  visitResetPasswordUrl();
  const expiredMock = {
    request: {
      query: CONFIRM_PASSWORD_RESET_MUTATION,
      variables: {
        input: {
          resetToken: 'e2e-test-token',
          newPassword: 'Correct-Horse-Battery-1!',
        },
      },
    },
    result: {
      errors: [
        new GraphQLError('invalid token', {
          extensions: { code: 'INVALID_TOKEN' },
        }),
      ],
    },
  };

  render(
    <MockedProvider mocks={[expiredMock]}>
      <SetPasswordPage />
    </MockedProvider>,
  );

  fireEvent.change(screen.getByTestId('newPassword-input'), {
    target: { value: 'Correct-Horse-Battery-1!' },
  });
  fireEvent.change(screen.getByTestId('confirmPassword-input'), {
    target: { value: 'Correct-Horse-Battery-1!' },
  });
  fireEvent.click(screen.getByTestId('set-password-button'));

  await waitFor(() => {
    expect(screen.getByTestId('token-expired-error')).toBeInTheDocument();
  });
  expect(
    screen.getByTestId('back-to-forgot-password-link'),
  ).toBeInTheDocument();
});
