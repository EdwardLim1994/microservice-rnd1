import { useMutation } from '@apollo/client/react';
import { LOGOUT_MUTATION } from '../types/repository';

/**
 * Apollo Client's `useMutation` IS the viewmodel here: it owns the in-flight/error state for
 * `logout`, reading from whichever `ApolloClient` the nearest `ApolloProvider` (see
 * `src/App.tsx`) supplies. `LOGOUT_MUTATION`'s own `TypedDocumentNode` type carries
 * `LogoutResult`/`LogoutVariables` here, so no generics need to be passed here.
 */
export function useLogout() {
  return useMutation(LOGOUT_MUTATION);
}
