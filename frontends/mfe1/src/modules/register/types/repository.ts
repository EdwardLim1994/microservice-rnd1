import { gql } from '@apollo/client';

// Hand-declared rather than imported from `api`'s generated `AuthGraphql` types — servers/auth's
// register mutation (feat/5-auth-subgraph-scaffold) hasn't merged yet as of this module, so the
// generated types don't exist on this branch. Reconcile with `AuthGraphql.RegisterResult` once
// that lands.
export interface RegisterResult {
  success: boolean;
  message: string;
}

export interface RegisterMutationResult {
  register: RegisterResult;
}

export interface RegisterMutationVariables {
  email: string;
  password: string;
}

export const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password) {
      success
      message
    }
  }
`;
