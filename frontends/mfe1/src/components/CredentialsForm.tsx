import type { ReactNode, SubmitEvent } from 'react';

export interface CredentialsFormProps {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  emailError: string | null;
  passwordError: string | null;
  loading: boolean;
  submitLabel: string;
  loadingLabel: string;
  onSubmit: (event: SubmitEvent) => void;
  successMessage: string | null;
  errorMessage: string | null;
  /** Extra regions (e.g. a storage-write error) rendered after the standard error message. */
  children?: ReactNode;
}

/**
 * Shared email + password form — used by both `register` and `login`, which differ only in
 * copy (submit/loading label) and what happens after a successful submit.
 */
export function CredentialsForm({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  emailError,
  passwordError,
  loading,
  submitLabel,
  loadingLabel,
  onSubmit,
  successMessage,
  errorMessage,
  children,
}: CredentialsFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-sm mx-auto">
      <label className="flex flex-col gap-1">
        <span>Email</span>
        <input
          data-testid="email-input"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
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
          onChange={(event) => onPasswordChange(event.target.value)}
        />
      </label>
      {passwordError && (
        <p data-testid="password-error" role="alert">
          {passwordError}
        </p>
      )}

      <button data-testid="submit-button" type="submit" disabled={loading}>
        {loading ? loadingLabel : submitLabel}
      </button>

      {successMessage && (
        <output data-testid="success-message">{successMessage}</output>
      )}
      {errorMessage && (
        <p data-testid="error-message" role="alert">
          {errorMessage}
        </p>
      )}
      {children}
    </form>
  );
}
