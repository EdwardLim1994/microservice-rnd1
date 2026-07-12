import { gql } from '@apollo/client';
import type { AuthGraphql } from 'api';

export type RegisterPayload = Pick<
  AuthGraphql.RegisterPayload,
  'success' | 'message'
>;

export interface RegisterResult {
  register: RegisterPayload;
}

export interface RegisterVariables {
  email: string;
  password: string;
}

/**
 * Data-layer mutation for the `register` module — see
 * `.openspec/requirements/release/integration-testing/auth.api.graphql` for the auth subgraph's
 * `register` mutation this calls, through Apollo Router.
 */
export const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password) {
      success
      message
    }
  }
`;
