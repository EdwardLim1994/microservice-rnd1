import type { SignInPayload } from '../pages/LoginPage';
import { decodeJwt, resolveRole } from './decodeJwt';

export type Session =
  | { status: 'signed-out' }
  | { status: 'must-change-password' }
  | { status: 'signed-in'; role: ReturnType<typeof resolveRole> };

// Pure — the routing decision App.tsx makes in response to a signIn payload, split out so it's
// testable without needing a real ApolloClient/network round-trip through the whole sign-in UI.
export function deriveSession(payload: SignInPayload): Session {
  if (payload.mustChangePassword) return { status: 'must-change-password' };
  return { status: 'signed-in', role: resolveRole(decodeJwt(payload.idToken)) };
}
