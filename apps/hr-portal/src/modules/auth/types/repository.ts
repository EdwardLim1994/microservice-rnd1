import { gql } from '@apollo/client';

export const SIGN_IN_MUTATION = gql`
  mutation SignIn($email: String!, $password: String!) {
    signIn(email: $email, password: $password) {
      accessToken
      refreshToken
      idToken
      mustChangePassword
    }
  }
`;

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignInResult {
  signIn: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
    mustChangePassword: boolean;
  };
}
