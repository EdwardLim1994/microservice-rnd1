import { useMutation } from '@apollo/client/react';
import { LOGOUT_MUTATION } from '../graphql/auth';
import { clearSession, getSession } from '../lib/session';

interface LogoutButtonProps {
  onLogout?: () => void;
}

export function LogoutButton({
  onLogout = () => globalThis.location?.assign('/login'),
}: LogoutButtonProps = {}) {
  const session = getSession();
  const [logout] = useMutation(LOGOUT_MUTATION);

  if (!session) return null;

  async function handleLogout() {
    if (session) {
      await logout({ variables: { accessToken: session.accessToken } }).catch(
        () => {},
      );
    }
    clearSession();
    onLogout();
  }

  return (
    <button type="button" data-testid="logout-button" onClick={handleLogout}>
      Log out
    </button>
  );
}
