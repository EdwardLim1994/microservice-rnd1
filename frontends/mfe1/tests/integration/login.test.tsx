import { gql } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
// `LoginPage` does not exist yet — this import fails to resolve until Dev scaffolds
// `frontends/mfe1/src/modules/login/` (pages/types/viewmodel, mirroring `modules/test1`/
// `modules/register`). That is expected: these are TDD-style integration tests written ahead of
// the implementation per issue #23 (FEAT-06), and they are meant to fail to compile/run until then.
import { LoginPage } from '../../src/modules/login';

// Design-token assumption: the sub-issue has no Claude Design handoff this release, so there are
// no dictated classes/colours to assert on. Per this repo's QA convention we test behaviour
// (presence of elements, text content, disabled/aria state) rather than styling. The following
// `data-testid`s are assumed and documented here for Dev to implement, mirroring
// `tests/integration/register.test.tsx`'s convention:
//   - "email-input"      — the email <input>
//   - "password-input"   — the password <input>
//   - "submit-button"    — the submit <button>
//   - "email-error"      — inline validation message shown under the email field
//   - "password-error"   — inline validation message shown under the password field
//   - "success-message"  — success banner shown after a successful login
//   - "error-message"    — error banner shown below the form for a failed `login` mutation
//                           response (GraphQL error) or a network/transport failure — same
//                           single-region convention as `register.test.tsx`
//   - "storage-error"    — separate from "error-message": shown when the mutation itself
//                           succeeds but writing the token set to localStorage throws. This is a
//                           distinct failure mode (a client-side exception after a successful
//                           server response, not a mutation error), so it gets its own region
//                           rather than reusing "error-message".

// Mirrors `login(email: String!, password: String!): AuthPayload!` from
// `.openspec/requirements/release/integration-testing/auth.api.graphql` — this is the mutation
// document this test suite expects Dev's `modules/login/viewmodel` to send. `MockedProvider`
// matches mocks on the exact query + variables, so this document is effectively part of this
// feature's contract, same as the `data-testid`s above.
const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      idToken
    }
  }
`;

const VALID_EMAIL = 'user@example.com';
const VALID_PASSWORD = 'correct-horse-battery-staple';

const TOKEN_STORAGE_KEYS = [
  'auth_access_token',
  'auth_refresh_token',
  'auth_id_token',
] as const;

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByTestId('email-input'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByTestId('password-input'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByTestId('submit-button'));
}

test('login page renders the email field, password field, and submit button', async () => {
  render(
    <MockedProvider mocks={[]}>
      <LoginPage />
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
      request: { query: LOGIN_MUTATION, variables: () => true },
      result: () => {
        mutationCalled = true;
        return {
          data: {
            login: {
              accessToken: 'should-not-be-reached',
              refreshToken: 'should-not-be-reached',
              idToken: 'should-not-be-reached',
            },
          },
        };
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LoginPage />
    </MockedProvider>,
  );

  fireEvent.click(await screen.findByTestId('submit-button'));

  expect(await screen.findByTestId('email-error')).toBeInTheDocument();
  expect(await screen.findByTestId('password-error')).toBeInTheDocument();

  // Give any (incorrect) mutation call a chance to resolve before asserting it never happened.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mutationCalled).toBe(false);
  for (const key of TOKEN_STORAGE_KEYS) {
    expect(window.localStorage.getItem(key)).toBeNull();
  }
});

test('submit button reflects a loading state while the mutation is in flight', async () => {
  const mocks = [
    {
      request: {
        query: LOGIN_MUTATION,
        variables: { email: VALID_EMAIL, password: VALID_PASSWORD },
      },
      result: {
        data: {
          login: {
            accessToken: 'access-token-value',
            refreshToken: 'refresh-token-value',
            idToken: 'id-token-value',
          },
        },
      },
      delay: 50,
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LoginPage />
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

test('on success, writes the full token set to localStorage and renders a success message', async () => {
  const mocks = [
    {
      request: {
        query: LOGIN_MUTATION,
        variables: { email: VALID_EMAIL, password: VALID_PASSWORD },
      },
      result: {
        data: {
          login: {
            accessToken: 'access-token-value',
            refreshToken: 'refresh-token-value',
            idToken: 'id-token-value',
          },
        },
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LoginPage />
    </MockedProvider>,
  );

  await screen.findByTestId('email-input');
  fillAndSubmit(VALID_EMAIL, VALID_PASSWORD);

  expect(await screen.findByTestId('success-message')).toBeInTheDocument();
  expect(window.localStorage.getItem('auth_access_token')).toBe(
    'access-token-value',
  );
  expect(window.localStorage.getItem('auth_refresh_token')).toBe(
    'refresh-token-value',
  );
  expect(window.localStorage.getItem('auth_id_token')).toBe('id-token-value');
});

test('renders the GraphQL error message from the mutation response on failure, and does not write to localStorage', async () => {
  const errorMessage = 'Invalid credentials.';
  const mocks = [
    {
      request: {
        query: LOGIN_MUTATION,
        variables: { email: VALID_EMAIL, password: VALID_PASSWORD },
      },
      result: { errors: [new GraphQLError(errorMessage)] },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LoginPage />
    </MockedProvider>,
  );

  await screen.findByTestId('email-input');
  fillAndSubmit(VALID_EMAIL, VALID_PASSWORD);

  expect(await screen.findByTestId('error-message')).toHaveTextContent(
    errorMessage,
  );
  expect(screen.queryByTestId('success-message')).not.toBeInTheDocument();
  for (const key of TOKEN_STORAGE_KEYS) {
    expect(window.localStorage.getItem(key)).toBeNull();
  }
});

test('renders a network error message when Apollo Router is unreachable', async () => {
  const mocks = [
    {
      request: {
        query: LOGIN_MUTATION,
        variables: { email: VALID_EMAIL, password: VALID_PASSWORD },
      },
      error: new Error('Failed to fetch'),
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LoginPage />
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

test('when localStorage is unavailable, catches the exception and displays a storage error message', async () => {
  const mocks = [
    {
      request: {
        query: LOGIN_MUTATION,
        variables: { email: VALID_EMAIL, password: VALID_PASSWORD },
      },
      result: {
        data: {
          login: {
            accessToken: 'access-token-value',
            refreshToken: 'refresh-token-value',
            idToken: 'id-token-value',
          },
        },
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LoginPage />
    </MockedProvider>,
  );

  await screen.findByTestId('email-input');

  // Override `setItem` for this one test only, to simulate localStorage being unavailable (e.g.
  // private browsing/quota exceeded), then restore the real implementation afterwards — per this
  // repo's convention of real `localStorage` (provided by happy-dom) everywhere except this one
  // edge case.
  const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
  window.localStorage.setItem = () => {
    throw new Error('localStorage is unavailable');
  };

  try {
    fillAndSubmit(VALID_EMAIL, VALID_PASSWORD);
    expect(await screen.findByTestId('storage-error')).toBeInTheDocument();
  } finally {
    window.localStorage.setItem = originalSetItem;
  }
});
