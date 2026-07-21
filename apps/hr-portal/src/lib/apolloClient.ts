import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getAccessToken } from '../modules/auth/lib/tokenStore';

// Pure — split out from the setContext callback so it's directly testable without needing to
// execute a real ApolloLink chain.
export function buildAuthHeaders(
  existingHeaders: Record<string, string> | undefined,
): Record<string, string> {
  const accessToken = getAccessToken();
  return {
    ...existingHeaders,
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
}

export function createApolloClient(uri: string): ApolloClient {
  const authLink = setContext((_, { headers }) => ({
    headers: buildAuthHeaders(headers),
  }));

  return new ApolloClient({
    link: authLink.concat(new HttpLink({ uri })),
    cache: new InMemoryCache(),
  });
}
