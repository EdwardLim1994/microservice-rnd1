import { ApolloProvider } from '@apollo/client/react';
import { useState } from 'react';
import { GRAPHQL_URL } from './config/env';
import { HrAdminHome } from './HrAdminHome';
import { createApolloClient } from './lib/apolloClient';
import {
  deriveSession,
  LoginPage,
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
      {session.status === 'signed-out' ? (
        <LoginPage onSignedIn={handleSignedIn} />
      ) : session.status === 'must-change-password' ? (
        // FEAT-5 (First-time forced password change) builds the real screen here — this is a
        // placeholder that only exists so FEAT-4's own redirect-on-mustChangePassword requirement
        // has somewhere to land.
        <div data-testid="must-change-password-placeholder" className="content">
          <h1>Change your password</h1>
          <p>This screen will be implemented by FEAT-5.</p>
        </div>
      ) : session.role === 'hr-admin' ? (
        <HrAdminHome />
      ) : (
        // Employee/Supervisor's role-based default page ("Dashboard") doesn't exist as a built
        // feature yet — placeholder until that page's own feature implements it.
        <div data-testid="dashboard-placeholder" className="content">
          <h1>Dashboard</h1>
          <p>This screen will be implemented by a future feature.</p>
        </div>
      )}
    </ApolloProvider>
  );
};

export default App;
