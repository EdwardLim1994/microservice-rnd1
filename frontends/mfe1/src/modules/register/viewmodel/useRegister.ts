import { useMutation } from '@apollo/client/react';
import {
  REGISTER_MUTATION,
  type RegisterResult,
  type RegisterVariables,
} from '../types/repository';

/**
 * Apollo Client's `useMutation` IS the viewmodel here: it owns the in-flight/error state for
 * `register`, reading from whichever `ApolloClient` the nearest `ApolloProvider` (see
 * `src/App.tsx`) supplies.
 */
export function useRegister() {
  return useMutation<RegisterResult, RegisterVariables>(REGISTER_MUTATION);
}
