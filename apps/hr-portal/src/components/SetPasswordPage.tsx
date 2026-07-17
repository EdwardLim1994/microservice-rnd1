import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { useMutation } from '@apollo/client/react';
import { type SyntheticEvent, useState } from 'react';
import { CONFIRM_PASSWORD_RESET_MUTATION } from '../graphql/passwordReset';

function getResetToken(): string {
  return (
    new URLSearchParams(globalThis.location?.search ?? '').get('token') ?? ''
  );
}

export function SetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mismatchError, setMismatchError] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [confirmPasswordReset, { loading }] = useMutation(
    CONFIRM_PASSWORD_RESET_MUTATION,
  );

  function handleConfirmBlur() {
    setMismatchError(!!confirmPassword && confirmPassword !== newPassword);
  }

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setMismatchError(false);
    setPolicyError(null);
    setTokenExpired(false);
    setBannerError(null);

    if (newPassword !== confirmPassword) {
      setMismatchError(true);
      return;
    }

    try {
      await confirmPasswordReset({
        variables: { input: { resetToken: getResetToken(), newPassword } },
      });
      setSuccess(true);
    } catch (submitError) {
      if (CombinedGraphQLErrors.is(submitError)) {
        const graphQLError = submitError.errors[0];
        const code = graphQLError?.extensions?.code;
        if (code === 'PASSWORD_POLICY_VIOLATION') {
          setPolicyError(graphQLError.message);
          return;
        }
        if (code === 'INVALID_TOKEN') {
          setTokenExpired(true);
          return;
        }
      }
      setBannerError('Something went wrong. Please try again.');
    }
  }

  if (success) {
    return (
      <div>
        <div data-testid="reset-confirm-success">
          Password updated. You can now log in.
        </div>
        <a href="/login" data-testid="login-link">
          Log in
        </a>
      </div>
    );
  }

  if (tokenExpired) {
    return (
      <div>
        <div data-testid="token-expired-error">Reset link expired.</div>
        <a href="/forgot-password" data-testid="back-to-forgot-password-link">
          Request a new reset link
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {bannerError && <div data-testid="error-banner">{bannerError}</div>}
      {policyError && <div data-testid="policy-error">{policyError}</div>}

      <label htmlFor="newPassword">New password</label>
      <input
        id="newPassword"
        type="password"
        data-testid="newPassword-input"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
      />

      <label htmlFor="confirmPassword">Confirm password</label>
      <input
        id="confirmPassword"
        type="password"
        data-testid="confirmPassword-input"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        onBlur={handleConfirmBlur}
        required
      />
      {mismatchError && (
        <div data-testid="password-mismatch-error">Passwords do not match</div>
      )}

      <button
        type="submit"
        data-testid="set-password-button"
        disabled={loading}
      >
        {loading ? 'Updating…' : 'Set New Password'}
      </button>
    </form>
  );
}
