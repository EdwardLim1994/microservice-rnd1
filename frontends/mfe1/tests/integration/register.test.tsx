import { gql } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
// `RegisterPage` does not exist yet — this import fails to resolve until Dev scaffolds
// `frontends/mfe1/src/modules/register/` (pages/types/viewmodel, mirroring `modules/test1`).
// That is expected: these are TDD-style integration tests written ahead of the implementation
// per issue #20 (FEAT-04), and they are meant to fail to compile/run until then.
import { RegisterPage } from '../../src/modules/register';

// Design-token assumption: the sub-issue has no Claude Design handoff this release, so there are
// no dictated classes/colours to assert on. Per this repo's QA convention we test behaviour
// (presence of elements, text content, disabled/aria state) rather than styling. The following
// `data-testid`s are assumed and documented here for Dev to implement:
//   - "email-input"      — the email <input>
//   - "password-input"   — the password <input>
//   - "submit-button"    — the submit <button>
//   - "email-error"      — inline validation message shown under the email field
//   - "password-error"   — inline validation message shown under the password field
//   - "success-message"  — success banner shown after a successful registration
//   - "error-message"    — single error banner shown below the form, used for both a GraphQL
//                           error response and a network/transport failure (the issue's UI Spec
//                           describes one "error message displayed below the form on API
//                           failure", not separate regions per failure type)

// Mirrors `register(email: String!, password: String!): RegisterPayload!` from
// `.openspec/requirements/release/integration-testing/auth.api.graphql` — this is the mutation
// document this test suite expects Dev's `modules/register/viewmodel` to send. `MockedProvider`
// matches mocks on the exact query + variables, so this document is effectively part of this
// feature's contract, same as the `data-testid`s above.
const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password) {
      success
      message
    }
  }
`;

const VALID_EMAIL = 'newuser@example.com';
const VALID_PASSWORD = 'correct-horse-battery-staple';

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByTestId('email-input'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByTestId('password-input'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByTestId('submit-button'));
}

test('register page renders the email field, password field, and submit button', async () => {
  render(
    <MockedProvider mocks={[]}>
      <RegisterPage />
    </MockedProvider>,
  );

  expect(await screen.findByTestId('email-input')).toBeInTheDocument();
  expect(screen.getByTestId('password-input')).toBeInTheDocument();
  expect(screen.getByTestId('submit-button')).toBeInTheDocument();
});

test('submitting with empty fields shows inline validation and never calls the mutation', async () => {
  // Manual call-tracking flag (per this repo's convention of avoiding `vi.fn()`/module mocks —
  // see packages/server/CLAUDE.md's Testing section): the mock's `result` function only runs if
  // MockedProvider actually matches and resolves a request for this operation, so it doubles as
  // proof the mutation was (or wasn't) invoked. The variable matcher accepts any variables so an
  // accidental call — even with blank strings — is still caught.
  let mutationCalled = false;
  const mocks = [
    {
      request: { query: REGISTER_MUTATION, variables: () => true },
      result: () => {
        mutationCalled = true;
        return {
          data: {
            register: { success: true, message: 'should not be reached' },
          },
        };
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <RegisterPage />
    </MockedProvider>,
  );

  fireEvent.click(await screen.findByTestId('submit-button'));

  expect(await screen.findByTestId('email-error')).toBeInTheDocument();
  expect(await screen.findByTestId('password-error')).toBeInTheDocument();

  // Give any (incorrect) mutation call a chance to resolve before asserting it never happened.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mutationCalled).toBe(false);
});

test('submit button reflects a loading state while the mutation is in flight', async () => {
  const mocks = [
    {
      request: {
        query: REGISTER_MUTATION,
        variables: { email: VALID_EMAIL, password: VALID_PASSWORD },
      },
      result: {
        data: {
          register: { success: true, message: 'Registration successful.' },
        },
      },
      delay: 50,
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <RegisterPage />
    </MockedProvider>,
  );

  await screen.findByTestId('email-input');
  fillAndSubmit(VALID_EMAIL, VALID_PASSWORD);

  await waitFor(() =>
    expect(screen.getByTestId('submit-button')).toBeDisabled(),
  );

  // ...and clears once the mutation settles.
  await waitFor(() =>
    expect(screen.getByTestId('submit-button')).not.toBeDisabled(),
  );
});

test('renders a success message on a successful mutation response and does not navigate away', async () => {
  const successMessage =
    'Registration successful. Please check your email to verify your account.';
  const mocks = [
    {
      request: {
        query: REGISTER_MUTATION,
        variables: { email: VALID_EMAIL, password: VALID_PASSWORD },
      },
      result: {
        data: { register: { success: true, message: successMessage } },
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <RegisterPage />
    </MockedProvider>,
  );

  await screen.findByTestId('email-input');
  fillAndSubmit(VALID_EMAIL, VALID_PASSWORD);

  expect(await screen.findByTestId('success-message')).toHaveTextContent(
    successMessage,
  );

  // "No navigation on success" (per issue #20's spec) — this test never renders a router, so the
  // strongest available signal is that the page itself is still mounted (RegisterPage did not
  // unmount/redirect) rather than having been swapped for another view entirely.
  expect(screen.getByTestId('email-input')).toBeInTheDocument();
});

test('renders the GraphQL error message from the mutation response on failure', async () => {
  const errorMessage = 'An account with this email already exists.';
  const mocks = [
    {
      request: {
        query: REGISTER_MUTATION,
        variables: { email: VALID_EMAIL, password: VALID_PASSWORD },
      },
      result: { errors: [new GraphQLError(errorMessage)] },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <RegisterPage />
    </MockedProvider>,
  );

  await screen.findByTestId('email-input');
  fillAndSubmit(VALID_EMAIL, VALID_PASSWORD);

  expect(await screen.findByTestId('error-message')).toHaveTextContent(
    errorMessage,
  );
  expect(screen.queryByTestId('success-message')).not.toBeInTheDocument();
});

test('renders a network error message when Apollo Router is unreachable', async () => {
  const mocks = [
    {
      request: {
        query: REGISTER_MUTATION,
        variables: { email: VALID_EMAIL, password: VALID_PASSWORD },
      },
      error: new Error('Failed to fetch'),
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <RegisterPage />
    </MockedProvider>,
  );

  await screen.findByTestId('email-input');
  fillAndSubmit(VALID_EMAIL, VALID_PASSWORD);

  // The server never responds in this scenario, so there is no response message to echo — only
  // assert that an error region renders with some non-empty, user-facing text.
  const errorMessage = await screen.findByTestId('error-message');
  expect(errorMessage).not.toHaveTextContent('');
  expect(screen.queryByTestId('success-message')).not.toBeInTheDocument();
});
