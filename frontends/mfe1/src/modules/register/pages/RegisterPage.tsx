import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { type SyntheticEvent, useState } from 'react';
import { useRegister } from '../viewmodel';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [register, { data, loading, error }] = useRegister();

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setValidationError('Email and password are required.');
      return;
    }
    setValidationError(null);
    register({ variables: { email, password } }).catch(() => {
      // Failure is surfaced via the `error` returned by useMutation below — nothing further to
      // do here, this just stops an unhandled promise rejection.
    });
  };

  if (data?.register.success) {
    return (
      <div className="flex flex-col items-center gap-2">
        <output>{data.register.message}</output>
      </div>
    );
  }

  // CombinedGraphQLErrors is the only ErrorLike shape carrying a server-authored message meant
  // for display (DUPLICATE_EMAIL/PASSWORD_POLICY/BAD_USER_INPUT/AUTHENTIK_UNAVAILABLE from
  // RegisterUseCase) — anything else (LinkError, ServerParseError, a bare fetch rejection, ...) is
  // a transport-level failure with no user-facing message of its own.
  const errorMessage = error
    ? CombinedGraphQLErrors.is(error)
      ? error.message
      : 'Network error — please check your connection and try again.'
    : null;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-2 max-w-sm mx-auto p-4"
    >
      <label htmlFor="register-email">Email</label>
      <input
        id="register-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <label htmlFor="register-password">Password</label>
      <input
        id="register-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      {validationError && <p role="alert">{validationError}</p>}
      {errorMessage && <p role="alert">{errorMessage}</p>}

      <button type="submit" disabled={loading}>
        {loading ? 'Creating account…' : 'Register'}
      </button>
    </form>
  );
}
