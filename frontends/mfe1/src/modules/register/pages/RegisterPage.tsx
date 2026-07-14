import { type SubmitEvent, useState } from 'react';
import { CredentialsForm } from '../../../components/CredentialsForm';
import { validateCredentials } from '../../../lib/credentialsValidation';
import { useRegister } from '../viewmodel';

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

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validation = validateCredentials(email, password);
    setEmailError(validation.emailError);
    setPasswordError(validation.passwordError);
    if (!validation.valid) {
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
    <CredentialsForm
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      emailError={emailError}
      passwordError={passwordError}
      loading={loading}
      submitLabel="Register"
      loadingLabel="Registering…"
      onSubmit={handleSubmit}
      successMessage={successMessage}
      errorMessage={errorMessage}
    />
  );
}
