import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getAccessToken } from '../modules/auth/lib/tokenStore';

export function createApolloClient(uri: string): ApolloClient {
  const authLink = setContext((_, { headers }) => {
    const accessToken = getAccessToken();
    return {
      headers: {
        ...headers,
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
    };
  });

  return new ApolloClient({
    link: authLink.concat(new HttpLink({ uri })),
    cache: new InMemoryCache(),
  });
}
