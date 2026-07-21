import { ApolloProvider } from '@apollo/client/react';
import { useState } from 'react';
import { AppShell } from './AppShell';
import { GRAPHQL_URL } from './config/env';
import { createApolloClient } from './lib/apolloClient';
import {
  deriveSession,
  type Session,
  type SignInPayload,
} from './modules/auth';
import { setAccessToken } from './modules/auth/lib/tokenStore';
import './App.css';

const apolloClient = createApolloClient(GRAPHQL_URL);

const App = () => {
  const [session, setSession] = useState<Session>({ status: 'signed-out' });

  function handleSignedIn(payload: SignInPayload) {
    setAccessToken(payload.accessToken);
    setSession(deriveSession(payload));
  }

  return (
    <ApolloProvider client={apolloClient}>
      <AppShell session={session} onSignedIn={handleSignedIn} />
    </ApolloProvider>
  );
};

export default App;
