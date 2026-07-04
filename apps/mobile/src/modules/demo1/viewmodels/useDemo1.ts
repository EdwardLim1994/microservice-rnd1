import { useQuery } from '@apollo/client/react';
import { GET_DEMO1_QUERY, type GetDemo1Result } from '../types/';

/**
 * Apollo Client's `useQuery` IS the viewmodel here: it owns loading/error/
 * data state for `demo1` and its `demo2` children, reading from whichever
 * `ApolloClient` the nearest `ApolloProvider` (see `src/app/_layout.tsx`)
 * supplies.
 */
export function useDemo1(): useQuery.Result<GetDemo1Result> {
  return useQuery(GET_DEMO1_QUERY);
}
