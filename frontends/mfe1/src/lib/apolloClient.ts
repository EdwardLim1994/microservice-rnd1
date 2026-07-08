import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

export function createApolloClient(uri: string): ApolloClient {
  return new ApolloClient({
    link: new HttpLink({ uri }),
    cache: new InMemoryCache(),
  });
}
