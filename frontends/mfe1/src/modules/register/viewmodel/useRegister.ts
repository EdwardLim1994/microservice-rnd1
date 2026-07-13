import { useMutation } from '@apollo/client/react';
import { REGISTER_MUTATION } from '../types/repository';

/**
 * Apollo Client's `useMutation` IS the viewmodel here: it owns the in-flight/error state for
 * `register`, reading from whichever `ApolloClient` the nearest `ApolloProvider` (see
 * `src/App.tsx`) supplies. `REGISTER_MUTATION`'s own `TypedDocumentNode` type carries
 * `RegisterResult`/`RegisterVariables` here, so no generics need to be (deprecated to) pass here.
 */
export function useRegister() {
  return useMutation(REGISTER_MUTATION);
}
