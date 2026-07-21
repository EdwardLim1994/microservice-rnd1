import { HrAdminHome } from './HrAdminHome';
import { LoginPage, type Session, type SignInPayload } from './modules/auth';

export interface AppShellProps {
  session: Session;
  onSignedIn: (payload: SignInPayload) => void;
}

// Purely presentational routing driven by `session` — split out from App.tsx so each branch is
// directly testable without needing a real ApolloClient/network round-trip through signIn.
export function AppShell({ session, onSignedIn }: AppShellProps) {
  if (session.status === 'signed-out') {
    return <LoginPage onSignedIn={onSignedIn} />;
  }

  if (session.status === 'must-change-password') {
    // FEAT-5 (First-time forced password change) builds the real screen here — this is a
    // placeholder that only exists so FEAT-4's own redirect-on-mustChangePassword requirement
    // has somewhere to land.
    return (
      <div data-testid="must-change-password-placeholder" className="content">
        <h1>Change your password</h1>
        <p>This screen will be implemented by FEAT-5.</p>
      </div>
    );
  }

  if (session.role === 'hr-admin') {
    return <HrAdminHome />;
  }

  // Employee/Supervisor's role-based default page ("Dashboard") doesn't exist as a built
  // feature yet — placeholder until that page's own feature implements it.
  return (
    <div data-testid="dashboard-placeholder" className="content">
      <h1>Dashboard</h1>
      <p>This screen will be implemented by a future feature.</p>
    </div>
  );
}
