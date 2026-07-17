import { useMutation } from '@apollo/client/react';
import { type SyntheticEvent, useState } from 'react';
import { REQUEST_PASSWORD_RESET_MUTATION } from '../graphql/passwordReset';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailFormatError, setEmailFormatError] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [requestPasswordReset, { loading }] = useMutation(
    REQUEST_PASSWORD_RESET_MUTATION,
  );

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailFormatError(false);
    setBannerError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setEmailFormatError(true);
      return;
    }

    try {
      await requestPasswordReset({ variables: { input: { email } } });
      setSuccess(true);
    } catch {
      setBannerError('Something went wrong. Please try again.');
    }
  }

  if (success) {
    return (
      <div data-testid="reset-request-success">
        If this email is registered, a reset link has been sent.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {bannerError && <div data-testid="error-banner">{bannerError}</div>}

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        data-testid="email-input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {emailFormatError && (
        <div data-testid="email-format-error">Enter a valid email address</div>
      )}

      <button
        type="submit"
        data-testid="send-reset-link-button"
        disabled={loading}
      >
        {loading ? 'Sending…' : 'Send Reset Link'}
      </button>
    </form>
  );
}
