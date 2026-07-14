import type { TypedDocumentNode } from '@apollo/client';
import { gql } from '@apollo/client';

// Declared locally rather than picked from `AuthGraphql.LogoutPayload` (as `register`'s module
// does for `RegisterPayload`) — `logout`/`LogoutPayload` aren't in `packages/api`'s generated
// auth types on this branch yet, since FEAT-07 (the logout mutation, issue #25) hasn't merged
// into this branch's base at the time this module was written — same situation `login`'s module
// documented for `AuthPayload`. The shape below mirrors the fixed SDL contract in
// `.openspec/requirements/release/integration-testing/auth.api.graphql` exactly.
export interface LogoutPayload {
  success: boolean;
  message: string;
}

export interface LogoutResult {
  logout: LogoutPayload;
}

export interface LogoutVariables {
  accessToken: string;
}

/**
 * Data-layer mutation for the `logout` module — see
 * `.openspec/requirements/release/integration-testing/auth.api.graphql` for the auth subgraph's
 * `logout` mutation this calls, through Apollo Router.
 */
export const LOGOUT_MUTATION: TypedDocumentNode<LogoutResult, LogoutVariables> =
  gql`
  mutation Logout($accessToken: String!) {
    logout(accessToken: $accessToken) {
      success
      message
    }
  }
`;
