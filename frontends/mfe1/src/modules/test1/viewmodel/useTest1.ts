import { useQuery } from '@apollo/client/react';
import { GET_TEST1_QUERY, type GetTest1Result } from '../types/repository';

/**
 * Apollo Client's `useQuery` IS the viewmodel here: it owns loading/error/
 * data state for `test1` and its `test2` children, reading from whichever
 * `ApolloClient` the nearest `ApolloProvider` (see `src/App.tsx`) supplies.
 */
export function useTest1(): useQuery.Result<GetTest1Result> {
  return useQuery(GET_TEST1_QUERY);
}
