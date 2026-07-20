import { useState } from 'react';
import { useRegisterEmployee } from '../viewmodel/useRegisterEmployee';

export interface RegisterEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  gender: '',
  email: '',
  grossSalary: '',
  salaryPerDay: '',
  supervisorId: '',
};

export function RegisterEmployeeModal({
  isOpen,
  onClose,
}: RegisterEmployeeModalProps) {
  const { registerEmployee, result, loading, error, reset } =
    useRegisterEmployee();
  const [form, setForm] = useState(EMPTY_FORM);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  function handleChange(field: keyof typeof EMPTY_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await registerEmployee({
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        email: form.email,
        grossSalary: Number(form.grossSalary),
        salaryPerDay: Number(form.salaryPerDay),
        supervisorId: form.supervisorId || undefined,
      });
    } catch {
      // Surfaced via the `error` state from useRegisterEmployee below — nothing else to do here.
    }
  }

  function handleCopy() {
    if (!result?.temporaryPassword) return;
    navigator.clipboard.writeText(result.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDone() {
    setForm(EMPTY_FORM);
    setCopied(false);
    reset();
    onClose();
  }

  return (
    <div data-testid="register-employee-modal">
      {result ? (
        <div data-testid="register-employee-success">
          <p>Employee registered successfully.</p>
          <p>Temporary password:</p>
          <code data-testid="register-employee-temp-password">
            {result.temporaryPassword}
          </code>
          <button
            type="button"
            data-testid="register-employee-copy"
            onClick={handleCopy}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            data-testid="register-employee-done"
            onClick={handleDone}
          >
            Done
          </button>
        </div>
      ) : (
        <form
          data-testid="register-employee-form"
          onSubmit={handleSubmit}
          style={loading ? { opacity: 0.6 } : undefined}
        >
          <input
            data-testid="register-employee-first-name"
            placeholder="First name"
            value={form.firstName}
            onChange={handleChange('firstName')}
            required
          />
          <input
            data-testid="register-employee-last-name"
            placeholder="Last name"
            value={form.lastName}
            onChange={handleChange('lastName')}
            required
          />
          <input
            data-testid="register-employee-gender"
            placeholder="Gender"
            value={form.gender}
            onChange={handleChange('gender')}
            required
          />
          <input
            data-testid="register-employee-email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange('email')}
            required
          />
          <input
            data-testid="register-employee-gross-salary"
            type="number"
            placeholder="Gross salary"
            value={form.grossSalary}
            onChange={handleChange('grossSalary')}
            required
          />
          <input
            data-testid="register-employee-salary-per-day"
            type="number"
            placeholder="Salary per day"
            value={form.salaryPerDay}
            onChange={handleChange('salaryPerDay')}
            required
          />
          {/* Free-text supervisor id for now — an inline-filtered search needs FEAT-2's
              employees list query, which doesn't exist yet. */}
          <input
            data-testid="register-employee-supervisor-id"
            placeholder="Supervisor ID (optional)"
            value={form.supervisorId}
            onChange={handleChange('supervisorId')}
          />
          {error ? (
            <p data-testid="register-employee-error">{error.message}</p>
          ) : null}
          <button
            type="submit"
            data-testid="register-employee-submit"
            disabled={loading}
          >
            {loading ? 'Submitting…' : 'Register'}
          </button>
        </form>
      )}
    </div>
  );
}
