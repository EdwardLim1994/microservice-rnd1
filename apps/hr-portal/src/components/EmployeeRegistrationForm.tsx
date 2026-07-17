import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import {
  EMPLOYEES_QUERY,
  REGISTER_EMPLOYEE_MUTATION,
} from '../graphql/employee';

interface EmployeeOption {
  id: string;
  fullName: string;
  employeeId: string;
}

const ROLES = ['Software Engineer', 'HR Admin', 'Analyst', 'Manager'];
const DEPARTMENTS = ['Engineering', 'Finance', 'HR', 'R&D'];

const emptyForm = {
  fullName: '',
  employeeId: '',
  role: ROLES[0],
  department: DEPARTMENTS[0],
  grossSalary: '',
  supervisorId: '',
};

export function EmployeeRegistrationForm() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [result, setResult] = useState<{ temporaryPassword: string } | null>(
    null,
  );

  const { data: employeesData } = useQuery<{ employees: EmployeeOption[] }>(
    EMPLOYEES_QUERY,
  );
  const supervisors: EmployeeOption[] = employeesData?.employees ?? [];

  interface RegisterEmployeeResponse {
    registerEmployee: { temporaryPassword: string };
  }

  const [registerEmployee, { loading }] = useMutation<RegisterEmployeeResponse>(
    REGISTER_EMPLOYEE_MUTATION,
    { refetchQueries: [{ query: EMPLOYEES_QUERY }] },
  );

  function openForm() {
    setForm(emptyForm);
    setFieldError(null);
    setBannerError(null);
    setResult(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setBannerError(null);

    try {
      const { data } = await registerEmployee({
        variables: {
          input: {
            fullName: form.fullName,
            employeeId: form.employeeId,
            role: form.role,
            department: form.department,
            grossSalary: Number(form.grossSalary),
            supervisorId: form.supervisorId || null,
          },
        },
      });
      if (!data) throw new Error('registerEmployee returned no data');
      setResult({ temporaryPassword: data.registerEmployee.temporaryPassword });
    } catch (error) {
      const code = CombinedGraphQLErrors.is(error)
        ? error.errors[0]?.extensions?.code
        : undefined;
      if (code === 'CONFLICT') {
        setFieldError('An employee with that employeeId already exists');
      } else {
        setBannerError('Something went wrong. Please try again.');
      }
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid="register-employee-button"
        onClick={openForm}
      >
        Register Employee
      </button>
    );
  }

  if (result) {
    return (
      <div>
        <p>Employee registered successfully.</p>
        <input
          data-testid="temporary-password-field"
          readOnly
          value={result.temporaryPassword}
        />
        <button
          type="button"
          data-testid="copy-password-button"
          onClick={() =>
            navigator.clipboard?.writeText(result.temporaryPassword)
          }
        >
          Copy
        </button>
        <button
          type="button"
          data-testid="register-employee-button"
          onClick={openForm}
        >
          Register Another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {bannerError && <div data-testid="error-banner">{bannerError}</div>}

      <label htmlFor="fullName">Full name</label>
      <input
        id="fullName"
        data-testid="fullName-input"
        value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        required
      />

      <label htmlFor="employeeId">Employee ID</label>
      <input
        id="employeeId"
        data-testid="employeeId-input"
        value={form.employeeId}
        onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
        required
      />
      {fieldError && <div data-testid="employeeId-error">{fieldError}</div>}

      <label htmlFor="role">Role</label>
      <select
        id="role"
        data-testid="role-select"
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>

      <label htmlFor="department">Department</label>
      <select
        id="department"
        data-testid="department-select"
        value={form.department}
        onChange={(e) => setForm({ ...form, department: e.target.value })}
      >
        {DEPARTMENTS.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
      </select>

      <label htmlFor="grossSalary">Gross salary</label>
      <input
        id="grossSalary"
        data-testid="grossSalary-input"
        type="number"
        value={form.grossSalary}
        onChange={(e) => setForm({ ...form, grossSalary: e.target.value })}
        required
      />

      <label htmlFor="supervisorId">Supervisor</label>
      {supervisors.length === 0 ? (
        <div data-testid="supervisor-dropdown">No supervisors available</div>
      ) : (
        <select
          id="supervisorId"
          data-testid="supervisor-dropdown"
          value={form.supervisorId}
          onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}
        >
          <option value="">No supervisor</option>
          {supervisors.map((supervisor) => (
            <option key={supervisor.id} value={supervisor.id}>
              {supervisor.fullName}
            </option>
          ))}
        </select>
      )}

      <button type="submit" data-testid="submit-button" disabled={loading}>
        {loading ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  );
}
