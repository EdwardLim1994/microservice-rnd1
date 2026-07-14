import { type SubmitEvent, useState } from 'react';
import type { LoginPayload } from '../types/repository';
import { useLogin } from '../viewmodel';

const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

const TOKEN_STORAGE_KEYS = {
  accessToken: 'auth_access_token',
  refreshToken: 'auth_refresh_token',
  idToken: 'auth_id_token',
} as const;

// Kept as a plain, non-component function — same React Compiler workaround as
// `register`'s `submitRegistration` (see its own comment for the reproducible bug this avoids).
type UseLoginMutate = ReturnType<typeof useLogin>[0];

type LoginOutcome =
  | { success: true; tokens: LoginPayload }
  | { success: false; message: string };

async function submitLogin(
  login: UseLoginMutate,
  email: string,
  password: string,
): Promise<LoginOutcome> {
  try {
    const result = await login({ variables: { email, password } });
    const payload = result.data?.login;
    if (!payload) {
      return { success: false, message: 'Login failed. Please try again.' };
    }
    return { success: true, tokens: payload };
  } catch (submitError) {
    return {
      success: false,
      message:
        submitError instanceof Error
          ? submitError.message
          : 'Unable to reach the server. Please try again.',
    };
  }
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [login, { loading }] = useLogin();

  function validate(): boolean {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    let valid = true;

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError('Enter a valid email address.');
      valid = false;
    } else {
      setEmailError(null);
    }

    if (!trimmedPassword) {
      setPasswordError('Password is required.');
      valid = false;
    } else {
      setPasswordError(null);
    }

    return valid;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setStorageError(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    const outcome = await submitLogin(login, email.trim(), password);
    if (!outcome.success) {
      setErrorMessage(outcome.message);
      return;
    }

    try {
      localStorage.setItem(
        TOKEN_STORAGE_KEYS.accessToken,
        outcome.tokens.accessToken,
      );
      localStorage.setItem(
        TOKEN_STORAGE_KEYS.refreshToken,
        outcome.tokens.refreshToken,
      );
      localStorage.setItem(TOKEN_STORAGE_KEYS.idToken, outcome.tokens.idToken);
      setSuccessMessage('Signed in successfully.');
    } catch {
      setStorageError('Unable to save your session. Please try again.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-sm mx-auto"
    >
      <label className="flex flex-col gap-1">
        <span>Email</span>
        <input
          data-testid="email-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {emailError && (
        <p data-testid="email-error" role="alert">
          {emailError}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span>Password</span>
        <input
          data-testid="password-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {passwordError && (
        <p data-testid="password-error" role="alert">
          {passwordError}
        </p>
      )}

      <button data-testid="submit-button" type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      {successMessage && (
        <output data-testid="success-message">{successMessage}</output>
      )}
      {errorMessage && (
        <p data-testid="error-message" role="alert">
          {errorMessage}
        </p>
      )}
      {storageError && (
        <p data-testid="storage-error" role="alert">
          {storageError}
        </p>
      )}
    </form>
  );
}
