import { useRef, useState } from 'react';
import {
  labelStyle,
  inputStyle as sharedInputStyle,
  primaryButtonStyle as sharedPrimaryButtonStyle,
} from '../../../lib/formStyles';
import { useSignIn } from '../viewmodel/useSignIn';

export interface SignInPayload {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  mustChangePassword: boolean;
}

export interface LoginPageProps {
  onSignedIn: (payload: SignInPayload) => void;
}

// Design tokens (see App.css's :root block) lifted from the Claude Design HR Portal project
// (Login / Forgot password views — HR Portal.dc.html). The mockup's "Forgot password" flow
// (Send Reset Link / Reset link sent) has no backing mutation anywhere in this release's
// OpenSpec (no forgotPassword feature exists in US-2's FEAT-4/5/6) — the link's navigation is
// implemented per FEAT-4's uiInteractions ("Forgot password link that navigates to the
// forgot-password view"), but the view itself is a visual placeholder, not a working feature.
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'var(--hr-color-input-readonly-bg)',
  fontFamily: 'var(--hr-font-family)',
};

const cardStyle: React.CSSProperties = {
  width: 420,
  maxWidth: '100%',
  background: 'var(--hr-color-surface)',
  border: '1px solid var(--hr-color-close-border)',
  borderRadius: 'var(--hr-radius-lg)',
  boxShadow: 'var(--hr-shadow-card)',
  padding: 40,
};

const inputStyle: React.CSSProperties = {
  ...sharedInputStyle,
  padding: '11px 14px',
};

const primaryButtonStyle: React.CSSProperties = {
  ...sharedPrimaryButtonStyle,
  padding: 12,
};

const linkStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--hr-color-primary)',
  textDecoration: 'none',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  padding: 0,
  fontFamily: 'inherit',
};

export function LoginPage({ onSignedIn }: LoginPageProps) {
  const { signIn, loading, error } = useSignIn();
  const [view, setView] = useState<'login' | 'forgot' | 'forgot-sent'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  // `loading` from useMutation only flips after a render following the click — a fast double
  // click can fire handleSubmit twice before that happens. This ref guards synchronously.
  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const { data } = await signIn({ email, password });
      if (data?.signIn) onSignedIn(data.signIn);
    } catch {
      // Surfaced via the `error` state from useSignIn below — nothing else to do here.
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <div data-testid="login-page" style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--hr-color-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            HR Portal
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--hr-color-text-muted)',
              marginTop: 6,
            }}
          >
            Sign in to your account
          </div>
        </div>

        {view === 'login' ? (
          <form data-testid="login-form" onSubmit={handleSubmit}>
            <label htmlFor="login-email" style={labelStyle}>
              Email
            </label>
            <input
              id="login-email"
              data-testid="login-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              required
            />

            <label htmlFor="login-password" style={labelStyle}>
              Password
            </label>
            <input
              id="login-password"
              data-testid="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, marginBottom: 8 }}
              required
            />
            <div
              style={{
                fontSize: 12,
                color: 'var(--hr-color-text-faint)',
                marginBottom: 20,
              }}
            >
              Your role is determined automatically from your account.
            </div>

            {error ? (
              <p
                data-testid="login-error"
                style={{
                  fontSize: 13,
                  color: 'var(--hr-color-danger)',
                  marginTop: -10,
                  marginBottom: 14,
                }}
              >
                {error.message}
              </p>
            ) : null}

            <button
              type="submit"
              data-testid="login-submit"
              disabled={loading}
              style={primaryButtonStyle}
            >
              {loading ? 'Logging in…' : 'Log In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                type="button"
                data-testid="login-forgot-password-link"
                style={linkStyle}
                onClick={() => setView('forgot')}
              >
                Forgot password?
              </button>
            </div>
          </form>
        ) : view === 'forgot' ? (
          <div data-testid="forgot-password-form">
            <label htmlFor="forgot-email" style={labelStyle}>
              Registered email
            </label>
            <input
              id="forgot-email"
              data-testid="forgot-password-email"
              type="email"
              placeholder="you@company.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              style={inputStyle}
              required
            />
            <button
              type="button"
              data-testid="forgot-password-submit"
              style={primaryButtonStyle}
              disabled={!forgotEmail}
              onClick={() => forgotEmail && setView('forgot-sent')}
            >
              Send Reset Link
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                data-testid="back-to-login-link"
                style={linkStyle}
                onClick={() => setView('login')}
              >
                Back to Login
              </button>
            </div>
          </div>
        ) : (
          <div
            data-testid="forgot-password-sent"
            style={{ textAlign: 'center' }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--hr-color-success)',
                marginBottom: 6,
              }}
            >
              Reset link sent
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--hr-color-text-muted)',
                marginBottom: 18,
              }}
            >
              Check {forgotEmail} for instructions.
            </div>
            <button
              type="button"
              data-testid="back-to-login-link"
              style={linkStyle}
              onClick={() => setView('login')}
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
