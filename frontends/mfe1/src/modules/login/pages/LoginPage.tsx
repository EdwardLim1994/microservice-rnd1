import { type SubmitEvent, useState } from 'react';
import { CredentialsForm } from '../../../components/CredentialsForm';
import { validateCredentials } from '../../../lib/credentialsValidation';
import type { LoginPayload } from '../types/repository';
import { useLogin } from '../viewmodel';

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

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setStorageError(null);
    setSuccessMessage(null);

    const validation = validateCredentials(email, password);
    setEmailError(validation.emailError);
    setPasswordError(validation.passwordError);
    if (!validation.valid) {
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
    <CredentialsForm
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      emailError={emailError}
      passwordError={passwordError}
      loading={loading}
      submitLabel="Sign in"
      loadingLabel="Signing in…"
      onSubmit={handleSubmit}
      successMessage={successMessage}
      errorMessage={errorMessage}
    >
      {storageError && (
        <p data-testid="storage-error" role="alert">
          {storageError}
        </p>
      )}
    </CredentialsForm>
  );
}
