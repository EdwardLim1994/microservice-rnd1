import { useState } from 'react';
import { AppShell } from './AppShell';
import {
  deriveSession,
  type Session,
  type SignInPayload,
} from './modules/auth';
import { setAccessToken } from './modules/auth/lib/tokenStore';
import './App.css';

const App = () => {
  const [session, setSession] = useState<Session>({ status: 'signed-out' });

  function handleSignedIn(payload: SignInPayload) {
    setAccessToken(payload.accessToken);
    setSession(deriveSession(payload));
  }

  return <AppShell session={session} onSignedIn={handleSignedIn} />;
};

export default App;
