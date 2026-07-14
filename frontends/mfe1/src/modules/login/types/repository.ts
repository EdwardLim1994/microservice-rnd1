import type { TypedDocumentNode } from '@apollo/client';
import { gql } from '@apollo/client';

// Declared locally rather than picked from `AuthGraphql.AuthPayload` (as `register`'s module does
// for `RegisterPayload`) — `login`/`AuthPayload` aren't in `packages/api`'s generated auth types
// on this branch yet, since FEAT-05 (the login mutation, issue #22) hasn't merged into
// `us/21-user-sign-in` at the time this module was written. The shape below mirrors the fixed SDL
// contract in `.openspec/requirements/release/integration-testing/auth.api.graphql` exactly.
export interface LoginPayload {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

export interface LoginResult {
  login: LoginPayload;
}

export interface LoginVariables {
  email: string;
  password: string;
}

/**
 * Data-layer mutation for the `login` module — see
 * `.openspec/requirements/release/integration-testing/auth.api.graphql` for the auth subgraph's
 * `login` mutation this calls, through Apollo Router.
 */
export const LOGIN_MUTATION: TypedDocumentNode<LoginResult, LoginVariables> =
  gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      idToken
    }
  }
`;
