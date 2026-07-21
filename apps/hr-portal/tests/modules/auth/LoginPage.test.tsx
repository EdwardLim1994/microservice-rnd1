import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginPage } from '../../../src/modules/auth/pages/LoginPage';
import { SIGN_IN_MUTATION } from '../../../src/modules/auth/types/repository';

function fillForm() {
  fireEvent.change(screen.getByTestId('login-email'), {
    target: { value: 'jane.doe@example.com' },
  });
  fireEvent.change(screen.getByTestId('login-password'), {
    target: { value: 'correct-password' },
  });
}

test('renders the login form by default', () => {
  render(
    <MockedProvider mocks={[]}>
      <LoginPage onSignedIn={() => {}} />
    </MockedProvider>,
  );
  expect(screen.getByTestId('login-form')).toBeInTheDocument();
});

test('submits the form and calls onSignedIn with the sign-in payload', async () => {
  const mocks = [
    {
      request: {
        query: SIGN_IN_MUTATION,
        variables: {
          email: 'jane.doe@example.com',
          password: 'correct-password',
        },
      },
      result: {
        data: {
          signIn: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            idToken: 'id-token',
            mustChangePassword: false,
          },
        },
      },
    },
  ];
  let signedInPayload: unknown;

  render(
    <MockedProvider mocks={mocks}>
      <LoginPage
        onSignedIn={(payload) => {
          signedInPayload = payload;
        }}
      />
    </MockedProvider>,
  );

  fillForm();
  fireEvent.click(screen.getByTestId('login-submit'));

  await waitFor(() => {
    expect(signedInPayload).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      idToken: 'id-token',
      mustChangePassword: false,
    });
  });
});

test('shows the error message returned by the API and does not call onSignedIn', async () => {
  const mocks = [
    {
      request: {
        query: SIGN_IN_MUTATION,
        variables: {
          email: 'jane.doe@example.com',
          password: 'correct-password',
        },
      },
      error: new Error('Invalid email or password'),
    },
  ];
  let signedInCalled = false;

  render(
    <MockedProvider mocks={mocks}>
      <LoginPage
        onSignedIn={() => {
          signedInCalled = true;
        }}
      />
    </MockedProvider>,
  );

  fillForm();
  fireEvent.click(screen.getByTestId('login-submit'));

  await waitFor(() => {
    expect(screen.getByTestId('login-error')).toBeInTheDocument();
  });
  expect(signedInCalled).toBe(false);
});

test('navigates to the forgot-password view and back', () => {
  render(
    <MockedProvider mocks={[]}>
      <LoginPage onSignedIn={() => {}} />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('login-forgot-password-link'));
  expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();

  fireEvent.click(screen.getByTestId('back-to-login-link'));
  expect(screen.getByTestId('login-form')).toBeInTheDocument();
});

test('forgot-password flow shows a confirmation after Send Reset Link', () => {
  render(
    <MockedProvider mocks={[]}>
      <LoginPage onSignedIn={() => {}} />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('login-forgot-password-link'));
  fireEvent.change(screen.getByTestId('forgot-password-email'), {
    target: { value: 'jane.doe@example.com' },
  });
  fireEvent.click(screen.getByTestId('forgot-password-submit'));

  expect(screen.getByTestId('forgot-password-sent')).toHaveTextContent(
    'jane.doe@example.com',
  );
});
