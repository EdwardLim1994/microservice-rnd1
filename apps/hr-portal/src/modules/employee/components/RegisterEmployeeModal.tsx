import { useState } from 'react';
import {
  inputStyle,
  labelStyle,
  primaryButtonStyle,
} from '../../../lib/formStyles';
import { useEmployees } from '../viewmodel/useEmployees';
import { useRegisterEmployee } from '../viewmodel/useRegisterEmployee';
import { ModalShell } from './ModalShell';
import { SupervisorSearch } from './SupervisorSearch';

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
  supervisorSearch: '',
  supervisorId: '',
};

// Design tokens (see App.css's :root block) lifted from the Claude Design HR Portal project
// (Register Employee modal — HR Portal.dc.html). The mockup's field set (Full Name / Employee ID
// / Role / Department) doesn't match FEAT-1's real GraphQL input contract (no employeeId/role/
// department fields exist server-side; gender/email/salaryPerDay are required but not shown in
// the mockup at all) — the visual language is applied to the real fields instead of copying the
// mockup's field list 1:1.
const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  margin: '0 0 20px 0',
  color: 'var(--hr-color-text)',
};

export function RegisterEmployeeModal({
  isOpen,
  onClose,
}: RegisterEmployeeModalProps) {
  const { registerEmployee, result, loading, error, reset } =
    useRegisterEmployee();
  // skip while closed — this modal is always mounted (see App.tsx), so without `skip` it would
  // fire EMPLOYEES_QUERY on every app load whether or not the user ever opens it.
  const { employees } = useEmployees({ skip: !isOpen });
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

  function handleClose() {
    setForm(EMPTY_FORM);
    setCopied(false);
    reset();
    onClose();
  }

  return (
    <ModalShell
      testId="register-employee-modal"
      closeTestId="register-employee-close"
      onClose={handleClose}
      width={480}
      scrollable
    >
      {result ? (
        <div data-testid="register-employee-success">
          <h2
            style={{
              ...titleStyle,
              margin: '0 0 8px 0',
              color: 'var(--hr-color-success)',
            }}
          >
            Employee Registered
          </h2>
          <div
            style={{
              fontSize: 13,
              color: 'var(--hr-color-text-muted)',
              marginBottom: 18,
            }}
          >
            A temporary password has been generated. Share it securely with{' '}
            {form.firstName} {form.lastName}.
          </div>
          <label htmlFor="register-employee-temp-password" style={labelStyle}>
            Temporary Password
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              id="register-employee-temp-password"
              data-testid="register-employee-temp-password"
              readOnly
              value={result.temporaryPassword}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid var(--hr-color-border)',
                borderRadius: 'var(--hr-radius)',
                fontSize: 14,
                fontFamily: 'var(--hr-font-family-mono)',
                background: 'var(--hr-color-input-readonly-bg)',
              }}
            />
            <button
              type="button"
              data-testid="register-employee-copy"
              onClick={handleCopy}
              style={{
                background: 'var(--hr-color-primary-bg)',
                color: 'var(--hr-color-primary)',
                border: '1px solid var(--hr-color-primary-border)',
                padding: '10px 16px',
                borderRadius: 'var(--hr-radius)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            data-testid="register-employee-done"
            onClick={handleClose}
            style={primaryButtonStyle}
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
          <h2 style={titleStyle}>Register Employee</h2>

          <label htmlFor="register-employee-first-name" style={labelStyle}>
            First Name
          </label>
          <input
            id="register-employee-first-name"
            data-testid="register-employee-first-name"
            placeholder="e.g. Alex"
            value={form.firstName}
            onChange={handleChange('firstName')}
            style={inputStyle}
            required
          />

          <label htmlFor="register-employee-last-name" style={labelStyle}>
            Last Name
          </label>
          <input
            id="register-employee-last-name"
            data-testid="register-employee-last-name"
            placeholder="e.g. Morgan"
            value={form.lastName}
            onChange={handleChange('lastName')}
            style={inputStyle}
            required
          />

          <label htmlFor="register-employee-email" style={labelStyle}>
            Email
          </label>
          <input
            id="register-employee-email"
            data-testid="register-employee-email"
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={handleChange('email')}
            style={inputStyle}
            required
          />

          <label htmlFor="register-employee-gender" style={labelStyle}>
            Gender
          </label>
          <input
            id="register-employee-gender"
            data-testid="register-employee-gender"
            placeholder="e.g. Female"
            value={form.gender}
            onChange={handleChange('gender')}
            style={inputStyle}
            required
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div>
              <label
                htmlFor="register-employee-gross-salary"
                style={labelStyle}
              >
                Gross Salary
              </label>
              <input
                id="register-employee-gross-salary"
                data-testid="register-employee-gross-salary"
                type="number"
                placeholder="e.g. 72000"
                value={form.grossSalary}
                onChange={handleChange('grossSalary')}
                style={{ ...inputStyle, marginBottom: 0 }}
                required
              />
            </div>
            <div>
              <label
                htmlFor="register-employee-salary-per-day"
                style={labelStyle}
              >
                Salary Per Day
              </label>
              <input
                id="register-employee-salary-per-day"
                data-testid="register-employee-salary-per-day"
                type="number"
                placeholder="e.g. 300"
                value={form.salaryPerDay}
                onChange={handleChange('salaryPerDay')}
                style={{ ...inputStyle, marginBottom: 0 }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <SupervisorSearch
              employees={employees}
              search={form.supervisorSearch}
              selectedId={form.supervisorId || null}
              onSearchChange={(value) =>
                // Editing the search text after a selection invalidates that selection — clear
                // supervisorId too, or the form would silently submit a stale supervisor that no
                // longer matches what's shown as selected.
                setForm((prev) => ({
                  ...prev,
                  supervisorSearch: value,
                  supervisorId: '',
                }))
              }
              onSelect={(employee) =>
                setForm((prev) => ({
                  ...prev,
                  supervisorId: employee.id,
                  supervisorSearch: `${employee.firstName} ${employee.lastName}`,
                }))
              }
              testIdPrefix="register-employee-supervisor"
            />
          </div>

          {error ? (
            <p
              data-testid="register-employee-error"
              style={{
                fontSize: 13,
                color: 'var(--hr-color-danger)',
                marginTop: -8,
                marginBottom: 14,
              }}
            >
              {error.message}
            </p>
          ) : null}

          <button
            type="submit"
            data-testid="register-employee-submit"
            disabled={loading}
            style={primaryButtonStyle}
          >
            {loading ? 'Submitting…' : 'Register'}
          </button>
        </form>
      )}
    </ModalShell>
  );
}
