// Each domain label excludes '.' so the two `+` groups either side of it can't both match the
// same characters — removes the backtracking ambiguity `[^\s@]+@[^\s@]+\.[^\s@]+` had.
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export interface CredentialsValidation {
  emailError: string | null;
  passwordError: string | null;
  valid: boolean;
}

/**
 * Shared by `register` and `login` — both forms validate an email + password pair the same way
 * before calling their respective mutation.
 */
export function validateCredentials(
  email: string,
  password: string,
): CredentialsValidation {
  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();

  const emailError =
    !trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)
      ? 'Enter a valid email address.'
      : null;
  const passwordError = !trimmedPassword ? 'Password is required.' : null;

  return {
    emailError,
    passwordError,
    valid: emailError === null && passwordError === null,
  };
}
