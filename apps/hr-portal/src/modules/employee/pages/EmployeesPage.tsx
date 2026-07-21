import { useEmployees } from '../viewmodel/useEmployees';

// Design tokens (see App.css's :root block) lifted from the Claude Design HR Portal project
// (Employees page — HR Portal.dc.html). The mockup's column set (Employee ID / Name / Role /
// Department / Salary / Supervisor / Status) doesn't match FEAT-2's real GraphQL output — same
// gap FEAT-1's RegisterEmployeeModal documented: no employeeId/role/department/status fields
// exist server-side. The mockup's visual language (table styling, horizontal scroll on overflow)
// is applied to the real fields (id, name, email, salary, supervisor) instead of copying the
// mockup's column list 1:1.
const cardStyle: React.CSSProperties = {
  background: 'var(--hr-color-surface)',
  border: '1px solid var(--hr-color-close-border)',
  borderRadius: 'var(--hr-radius-lg)',
  overflow: 'hidden',
  fontFamily: 'var(--hr-font-family)',
};

const scrollStyle: React.CSSProperties = {
  overflowX: 'auto',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 600,
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 18px',
  color: 'var(--hr-color-text-muted)',
  fontWeight: 600,
  background: 'var(--hr-color-table-header-bg)',
  borderBottom: '1px solid var(--hr-color-close-border)',
};

const tdStyle: React.CSSProperties = {
  padding: '13px 18px',
  borderBottom: '1px solid var(--hr-color-row-border)',
  color: 'var(--hr-color-text-secondary)',
};

function formatSalary(amount: number) {
  return `$${amount.toLocaleString('en-US')}`;
}

export function EmployeesPage() {
  const { employees, loading, error } = useEmployees();

  return (
    <div data-testid="employees-page">
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          margin: '0 0 22px 0',
          color: 'var(--hr-color-text)',
        }}
      >
        Employees
      </h1>

      {loading ? (
        <p data-testid="employees-loading">Loading…</p>
      ) : error ? (
        <p
          data-testid="employees-error"
          style={{ color: 'var(--hr-color-danger)' }}
        >
          {error.message}
        </p>
      ) : (
        <div style={cardStyle}>
          <div style={scrollStyle}>
            <table data-testid="employees-table" style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Employee ID</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Salary</th>
                  <th style={thStyle}>Supervisor</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td
                      data-testid="employees-empty"
                      style={tdStyle}
                      colSpan={5}
                    >
                      No employees yet.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr
                      key={employee.id}
                      data-testid={`employee-row-${employee.id}`}
                    >
                      <td style={tdStyle}>{employee.id}</td>
                      <td
                        style={{
                          ...tdStyle,
                          color: 'var(--hr-color-text)',
                          fontWeight: 600,
                        }}
                      >
                        {employee.firstName} {employee.lastName}
                      </td>
                      <td style={tdStyle}>{employee.email}</td>
                      <td style={tdStyle}>
                        {formatSalary(employee.grossSalary)}
                      </td>
                      <td style={tdStyle}>
                        {employee.supervisor
                          ? `${employee.supervisor.firstName} ${employee.supervisor.lastName}`
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
