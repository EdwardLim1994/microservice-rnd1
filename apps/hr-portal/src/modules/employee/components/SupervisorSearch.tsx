import type { Employee } from '../types/repository';

export interface SupervisorSearchProps {
  employees: Employee[];
  excludeId?: string;
  search: string;
  selectedId: string | null;
  onSearchChange: (value: string) => void;
  onSelect: (employee: Employee) => void;
  testIdPrefix: string;
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--hr-color-text-secondary)',
  display: 'block',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--hr-color-border)',
  borderRadius: 'var(--hr-radius)',
  fontSize: 14,
  fontFamily: 'inherit',
};

const dropdownStyle: React.CSSProperties = {
  border: '1px solid var(--hr-color-close-border)',
  borderRadius: 'var(--hr-radius)',
  marginTop: 6,
  maxHeight: 130,
  overflowY: 'auto',
};

// Design lifted from the Claude Design HR Portal project's Register Employee modal (supervisor
// search field) — real-time name filter, selected-supervisor highlight. Shared between
// RegisterEmployeeModal (assigning at registration time) and AssignSupervisorModal (FEAT-3's
// standalone assign action), since both need the identical search+select behaviour.
export function SupervisorSearch({
  employees,
  excludeId,
  search,
  selectedId,
  onSearchChange,
  onSelect,
  testIdPrefix,
}: SupervisorSearchProps) {
  const options = employees.filter(
    (employee) =>
      employee.id !== excludeId &&
      `${employee.firstName} ${employee.lastName}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selected = employees.find((employee) => employee.id === selectedId);

  return (
    <div>
      <label htmlFor={`${testIdPrefix}-search`} style={labelStyle}>
        Supervisor
      </label>
      <input
        id={`${testIdPrefix}-search`}
        data-testid={`${testIdPrefix}-search`}
        type="text"
        placeholder="Search supervisor by name"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        style={inputStyle}
      />
      <div data-testid={`${testIdPrefix}-options`} style={dropdownStyle}>
        {options.map((employee) => (
          <div
            key={employee.id}
            data-testid={`${testIdPrefix}-option-${employee.id}`}
            onClick={() => onSelect(employee)}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(employee)}
            role="option"
            aria-selected={employee.id === selectedId}
            tabIndex={0}
            style={{
              padding: '9px 12px',
              fontSize: 13,
              cursor: 'pointer',
              borderBottom: '1px solid var(--hr-color-row-border)',
              background:
                employee.id === selectedId
                  ? 'var(--hr-color-primary-bg)'
                  : 'var(--hr-color-surface)',
              color: 'var(--hr-color-text-secondary)',
            }}
          >
            {employee.firstName} {employee.lastName}
          </div>
        ))}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--hr-color-text-muted)',
          marginTop: 8,
        }}
      >
        Selected:{' '}
        <strong style={{ color: 'var(--hr-color-text)' }}>
          {selected ? `${selected.firstName} ${selected.lastName}` : 'None'}
        </strong>
      </div>
    </div>
  );
}
