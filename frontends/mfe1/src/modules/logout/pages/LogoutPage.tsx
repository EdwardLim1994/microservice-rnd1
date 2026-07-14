import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { useState } from 'react';
import { useLogout } from '../viewmodel';

const TOKEN_STORAGE_KEYS = {
  accessToken: 'auth_access_token',
  refreshToken: 'auth_refresh_token',
  idToken: 'auth_id_token',
} as const;

function clearAuthKeys() {
  localStorage.removeItem(TOKEN_STORAGE_KEYS.accessToken);
  localStorage.removeItem(TOKEN_STORAGE_KEYS.refreshToken);
  localStorage.removeItem(TOKEN_STORAGE_KEYS.idToken);
}

type SignOutOutcome =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'network-error'; message: string }
  | { kind: 'not-signed-in'; message: string };

// Kept as a plain, non-component function — same React Compiler workaround as `register`'s
// `submitRegistration` (see its own comment for the reproducible bug this avoids).
type UseLogoutMutate = ReturnType<typeof useLogout>[0];

async function submitLogout(
  logout: UseLogoutMutate,
  accessToken: string,
): Promise<SignOutOutcome> {
  try {
    const result = await logout({ variables: { accessToken } });
    const payload = result.data?.logout;
    if (payload?.success) {
      return { kind: 'success', message: payload.message };
    }
    return {
      kind: 'error',
      message: payload?.message ?? 'Sign out failed. Please try again.',
    };
  } catch (submitError) {
    if (CombinedGraphQLErrors.is(submitError)) {
      return { kind: 'error', message: submitError.message };
    }
    return {
      kind: 'network-error',
      message: 'Unable to reach the server. Please try again.',
    };
  }
}

export function LogoutPage() {
  const [outcome, setOutcome] = useState<SignOutOutcome | null>(null);
  const [logout, { loading }] = useLogout();

  async function handleSignOut() {
    setOutcome(null);

    const accessToken = localStorage.getItem(TOKEN_STORAGE_KEYS.accessToken);
    if (!accessToken) {
      clearAuthKeys();
      setOutcome({ kind: 'not-signed-in', message: 'You were not signed in.' });
      return;
    }

    const result = await submitLogout(logout, accessToken);
    // localStorage is cleared client-side regardless of the mutation's outcome — the client's
    // own session is over either way, whether or not the server confirms it.
    clearAuthKeys();
    setOutcome(result);
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto">
      <button
        data-testid="sign-out-button"
        type="button"
        disabled={loading}
        onClick={handleSignOut}
      >
        {loading ? 'Signing out…' : 'Sign out'}
      </button>

      {outcome?.kind === 'success' && (
        <output data-testid="sign-out-success-message">
          {outcome.message}
        </output>
      )}
      {outcome?.kind === 'not-signed-in' && (
        <output data-testid="sign-out-not-signed-in-message">
          {outcome.message}
        </output>
      )}
      {outcome?.kind === 'error' && (
        <p data-testid="sign-out-error-message" role="alert">
          {outcome.message}
        </p>
      )}
      {outcome?.kind === 'network-error' && (
        <p data-testid="sign-out-network-error-message" role="alert">
          {outcome.message}
        </p>
      )}
    </div>
  );
}
