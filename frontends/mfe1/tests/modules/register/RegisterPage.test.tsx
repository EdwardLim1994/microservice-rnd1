import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { RegisterPage } from '../../../src/modules/register';
import { REGISTER_MUTATION } from '../../../src/modules/register/types/repository';

function fillAndSubmit(email: string, password: string) {
  if (email)
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: email },
    });
  if (password)
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: password },
    });
  fireEvent.click(screen.getByRole('button', { name: /register/i }));
}

test('shows inline validation and does not call the mutation on an empty email', async () => {
  render(
    <MockedProvider mocks={[]}>
      <RegisterPage />
    </MockedProvider>,
  );

  fillAndSubmit('', 'SuperSecret123!');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    /email and password are required/i,
  );
});

test('shows inline validation and does not call the mutation on an empty password', async () => {
  render(
    <MockedProvider mocks={[]}>
      <RegisterPage />
    </MockedProvider>,
  );

  fillAndSubmit('new@example.com', '');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    /email and password are required/i,
  );
});

test('shows a success message on a successful registration', async () => {
  const mocks = [
    {
      request: {
        query: REGISTER_MUTATION,
        variables: { email: 'new@example.com', password: 'SuperSecret123!' },
      },
      result: {
        data: {
          register: { success: true, message: 'Account created successfully' },
        },
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <RegisterPage />
    </MockedProvider>,
  );

  fillAndSubmit('new@example.com', 'SuperSecret123!');

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Account created successfully',
  );
});

test('shows the server error message on a GraphQL error (e.g. duplicate email)', async () => {
  const mocks = [
    {
      request: {
        query: REGISTER_MUTATION,
        variables: { email: 'dup@example.com', password: 'SuperSecret123!' },
      },
      result: {
        errors: [{ message: 'An account with this email already exists' }],
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <RegisterPage />
    </MockedProvider>,
  );

  fillAndSubmit('dup@example.com', 'SuperSecret123!');

  expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
});

test('shows a network error message when the mutation fails at the transport level', async () => {
  const mocks = [
    {
      request: {
        query: REGISTER_MUTATION,
        variables: { email: 'new@example.com', password: 'SuperSecret123!' },
      },
      error: new Error('Failed to fetch'),
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <RegisterPage />
    </MockedProvider>,
  );

  fillAndSubmit('new@example.com', 'SuperSecret123!');

  expect(await screen.findByRole('alert')).toHaveTextContent(/network error/i);
});
