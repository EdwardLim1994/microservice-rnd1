import { type FormEvent, useState } from 'react';
import { useRegister } from '../viewmodel';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [register, { loading }] = useRegister();

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    try {
      const result = await register({
        variables: { email: email.trim(), password },
      });
      const payload = result.data?.register;
      if (payload?.success) {
        setSuccessMessage(payload.message);
      } else {
        setErrorMessage(
          payload?.message ?? 'Registration failed. Please try again.',
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to reach the server. Please try again.',
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-sm mx-auto"
    >
      <label className="flex flex-col gap-1">
        Email
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
        Password
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
        {loading ? 'Registering…' : 'Register'}
      </button>

      {successMessage && (
        <p data-testid="success-message" role="status">
          {successMessage}
        </p>
      )}
      {errorMessage && (
        <p data-testid="error-message" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
