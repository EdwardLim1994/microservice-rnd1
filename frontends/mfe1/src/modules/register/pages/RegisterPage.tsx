import { type SubmitEvent, useState } from 'react';
import { useRegister } from '../viewmodel';

// Each domain label excludes '.' so the two `+` groups either side of it can't both match the
// same characters — removes the backtracking ambiguity `[^\s@]+@[^\s@]+\.[^\s@]+` had.
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

// Kept as a plain, non-component function (not inlined into RegisterPage's body) — Rsbuild's
// React Compiler plugin only transforms functions matching its Component/Hook naming heuristic,
// and folding this try/catch directly into RegisterPage's body triggered a reproducible compiler
// bug: the compiled output referenced the `catch` clause's bound variable outside the scope it
// generated a declaration for, throwing `ReferenceError: error is not defined` at submit time
// (dev server, `reactCompiler: true` in rsbuild.config.ts). Moving the async mutation call +
// error handling out here sidesteps it entirely.
type UseRegisterMutate = ReturnType<typeof useRegister>[0];

async function submitRegistration(
  register: UseRegisterMutate,
  email: string,
  password: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await register({ variables: { email, password } });
    const payload = result.data?.register;
    if (payload?.success) {
      return { success: true, message: payload.message };
    }
    return {
      success: false,
      message: payload?.message ?? 'Registration failed. Please try again.',
    };
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

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    const outcome = await submitRegistration(register, email.trim(), password);
    if (outcome.success) {
      setSuccessMessage(outcome.message);
    } else {
      setErrorMessage(outcome.message);
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
        {loading ? 'Registering…' : 'Register'}
      </button>

      {successMessage && (
        <output data-testid="success-message">{successMessage}</output>
      )}
      {errorMessage && (
        <p data-testid="error-message" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
