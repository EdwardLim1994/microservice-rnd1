import { useMutation } from '@apollo/client/react';
import {
  SIGN_IN_MUTATION,
  type SignInInput,
  type SignInResult,
} from '../types/repository';

export function useSignIn() {
  const [signInMutation, { loading, error, reset }] = useMutation<
    SignInResult,
    SignInInput
  >(SIGN_IN_MUTATION);

  return {
    signIn: (input: SignInInput) => signInMutation({ variables: input }),
    loading,
    error,
    reset,
  };
}
