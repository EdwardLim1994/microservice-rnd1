import { ApolloProvider } from '@apollo/client/react';
import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import type { JSX } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { GRAPHQL_URL } from '../config/env';
import { createApolloClient } from '../lib/apolloClient';

import '../global.css';

const apolloClient = createApolloClient(GRAPHQL_URL);

export default function RootLayout(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ApolloProvider client={apolloClient}>
        <HeroUINativeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </HeroUINativeProvider>
      </ApolloProvider>
    </GestureHandlerRootView>
  );
}
