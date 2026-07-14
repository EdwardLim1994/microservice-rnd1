import { useMutation } from '@apollo/client/react';
import { LOGIN_MUTATION } from '../types/repository';

/**
 * Apollo Client's `useMutation` IS the viewmodel here: it owns the in-flight/error state for
 * `login`, reading from whichever `ApolloClient` the nearest `ApolloProvider` (see
 * `src/App.tsx`) supplies. `LOGIN_MUTATION`'s own `TypedDocumentNode` type carries
 * `LoginResult`/`LoginVariables` here, so no generics need to be passed here.
 */
export function useLogin() {
  return useMutation(LOGIN_MUTATION);
}
