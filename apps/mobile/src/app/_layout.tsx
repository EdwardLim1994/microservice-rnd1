import { ApolloProvider } from '@apollo/client/react';
import { Stack } from 'expo-router';
import { GRAPHQL_URL } from '../config/env';
import { createApolloClient } from '../lib/apolloClient';

const apolloClient = createApolloClient(GRAPHQL_URL);

export default function RootLayout() {
  return (
    <ApolloProvider client={apolloClient}>
      <Stack />
    </ApolloProvider>
  );
}
