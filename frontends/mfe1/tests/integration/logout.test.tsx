import { gql } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
// `LogoutPage` does not exist yet — this import fails until Dev adds
// `frontends/mfe1/src/modules/logout/` (pages/types/viewmodel, mirroring the `test1` module
// convention documented in `frontends/mfe1/src/modules/test1/index.ts`). That failure is expected
// for these TDD-first integration tests: they pin the contract Dev implements against.
import { LogoutPage } from '../../src/modules/logout';

/**
 * Assumptions this test file makes about the not-yet-built `logout` module (documented here since
 * nothing in issue #26's UI Spec nails these down beyond "sign-out button" / "success message" /
 * "error message"):
 *
 * - The sign-out button is queryable via `data-testid="sign-out-button"`, and is `disabled` while
 *   the mutation is in flight (the issue's only required "loading state" behaviour — no specific
 *   spinner/label is mandated, so we assert the disabled state, not any visual/copy detail).
 * - Outcome messages are queryable via one `data-testid` per distinct outcome the issue calls out
 *   as producing a *different* message (success / GraphQL error / network error / not-signed-in):
 *   `data-testid="sign-out-success-message"`, `"sign-out-error-message"`,
 *   `"sign-out-network-error-message"`, `"sign-out-not-signed-in-message"`. We assert presence
 *   only, never exact copy — copy is a design-token concern the issue explicitly punts on ("No
 *   Claude Design handoff this release").
 * - The mutation itself: `servers/auth`'s auth subgraph exposes `logout(accessToken: String!):
 *   LogoutPayload!` (`LogoutPayload { success: Boolean!, message: String! }`), replacing the old
 *   `signOut(refreshToken): Boolean!` per FEAT-07 (issue #25) and the OpenSpec SDL at
 *   `.openspec/requirements/release/integration-testing/auth.api.graphql`. The issue's own Input
 *   line ("access token read from localStorage auth_access_token") is therefore both the presence
 *   check that decides whether to call the mutation at all (mirroring the issue's edge case "No
 *   token found in localStorage... skip the mutation call") AND the mutation variable itself.
 *   `LOGOUT_MUTATION` below is therefore the exact document (name, field, argument) the `logout`
 *   module's data layer must reproduce byte-for-byte — `MockedProvider` matches mocks by query AST
 *   + variables, so any deviation (different operation name, field alias, argument name) makes
 *   every mock below go unmatched.
 */

const LOGOUT_MUTATION = gql`
  mutation Logout($accessToken: String!) {
    logout(accessToken: $accessToken) {
      success
      message
    }
  }
`;

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const ID_TOKEN_KEY = 'auth_id_token';
const AUTH_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, ID_TOKEN_KEY] as const;

const MOCK_ACCESS_TOKEN = 'mock-access-token';
const MOCK_REFRESH_TOKEN = 'mock-refresh-token';
const MOCK_ID_TOKEN = 'mock-id-token';

/** Seeds localStorage as if a real signIn had already happened. */
function seedSignedInStorage() {
  localStorage.setItem(ACCESS_TOKEN_KEY, MOCK_ACCESS_TOKEN);
  localStorage.setItem(REFRESH_TOKEN_KEY, MOCK_REFRESH_TOKEN);
  localStorage.setItem(ID_TOKEN_KEY, MOCK_ID_TOKEN);
}

function expectAllAuthKeysCleared() {
  for (const key of AUTH_KEYS) {
    expect(localStorage.getItem(key)).toBeNull();
  }
}

async function clickSignOut() {
  const button = await screen.findByTestId('sign-out-button');
  fireEvent.click(button);
  return button;
}

test('renders the sign-out button', async () => {
  render(
    <MockedProvider mocks={[]}>
      <LogoutPage />
    </MockedProvider>,
  );

  expect(await screen.findByTestId('sign-out-button')).toBeInTheDocument();
});

test('shows a loading state on the button while the mutation is in flight', async () => {
  seedSignedInStorage();

  const mocks = [
    {
      request: {
        query: LOGOUT_MUTATION,
        variables: { accessToken: MOCK_ACCESS_TOKEN },
      },
      result: {
        data: {
          logout: { success: true, message: 'Signed out successfully.' },
        },
      },
      // Long enough that the assertion right after click reliably observes the in-flight state
      // before the mock resolves.
      delay: 50,
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LogoutPage />
    </MockedProvider>,
  );

  const button = await clickSignOut();
  expect(button).toBeDisabled();

  // Once the mutation resolves, the loading state clears again.
  await waitFor(() => expect(button).not.toBeDisabled());
});

test('on successful sign-out, clears all auth keys and shows a success message', async () => {
  seedSignedInStorage();

  const mocks = [
    {
      request: {
        query: LOGOUT_MUTATION,
        variables: { accessToken: MOCK_ACCESS_TOKEN },
      },
      result: {
        data: {
          logout: { success: true, message: 'Signed out successfully.' },
        },
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LogoutPage />
    </MockedProvider>,
  );

  await clickSignOut();

  expect(
    await screen.findByTestId('sign-out-success-message'),
  ).toBeInTheDocument();
  expectAllAuthKeysCleared();
});

test('clears all auth keys and shows an error message when the mutation resolves with success: false', async () => {
  // Distinct from the GraphQL-error case below: the mutation itself succeeds (no `errors`), but
  // the payload reports failure — e.g. `LogoutUseCase` returning `{ success: false, message }`.
  seedSignedInStorage();

  const mocks = [
    {
      request: {
        query: LOGOUT_MUTATION,
        variables: { accessToken: MOCK_ACCESS_TOKEN },
      },
      result: {
        data: {
          logout: {
            success: false,
            message: 'Unable to sign out. Please try again.',
          },
        },
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LogoutPage />
    </MockedProvider>,
  );

  await clickSignOut();

  expect(
    await screen.findByTestId('sign-out-error-message'),
  ).toBeInTheDocument();
  expectAllAuthKeysCleared();
});

test('clears all auth keys even when the mutation returns a GraphQL error', async () => {
  // This is the critical edge case from issue #26: localStorage must be cleared client-side
  // "regardless of mutation success or failure" — not only cleared on the happy path.
  seedSignedInStorage();

  const mocks = [
    {
      request: {
        query: LOGOUT_MUTATION,
        variables: { accessToken: MOCK_ACCESS_TOKEN },
      },
      result: {
        errors: [
          new GraphQLError(
            'The provided access token is invalid or has expired',
          ),
        ],
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LogoutPage />
    </MockedProvider>,
  );

  await clickSignOut();

  expect(
    await screen.findByTestId('sign-out-error-message'),
  ).toBeInTheDocument();
  expectAllAuthKeysCleared();
});

test('when no token is in localStorage, never calls the mutation, clears keys anyway, and shows a not-signed-in message', async () => {
  // Deliberately not seeding any auth_* keys — this is the "not signed in" edge case.
  let mutationCallCount = 0;

  const mocks = [
    {
      request: {
        query: LOGOUT_MUTATION,
        variables: { accessToken: MOCK_ACCESS_TOKEN },
      },
      result: () => {
        // Tracked via the mock itself (per this repo's convention of official test helpers over
        // `vi` module mocks) — this must stay at 0 for this scenario, since the component is
        // expected to skip the mutation entirely when there's no token to sign out with.
        mutationCallCount += 1;
        return {
          data: {
            logout: { success: true, message: 'Signed out successfully.' },
          },
        };
      },
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LogoutPage />
    </MockedProvider>,
  );

  await clickSignOut();

  expect(
    await screen.findByTestId('sign-out-not-signed-in-message'),
  ).toBeInTheDocument();
  expect(mutationCallCount).toBe(0);
  expectAllAuthKeysCleared();
});

test('clears all auth keys even when the network/Apollo Router request fails', async () => {
  seedSignedInStorage();

  const mocks = [
    {
      request: {
        query: LOGOUT_MUTATION,
        variables: { accessToken: MOCK_ACCESS_TOKEN },
      },
      // A transport-level failure (e.g. Apollo Router unreachable), distinct from a GraphQL
      // error in `result.errors` above.
      error: new Error('Failed to fetch'),
    },
  ];

  render(
    <MockedProvider mocks={mocks}>
      <LogoutPage />
    </MockedProvider>,
  );

  await clickSignOut();

  expect(
    await screen.findByTestId('sign-out-network-error-message'),
  ).toBeInTheDocument();
  expectAllAuthKeysCleared();
});
