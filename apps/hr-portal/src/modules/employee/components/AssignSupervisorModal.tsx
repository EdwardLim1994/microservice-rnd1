import { useState } from 'react';
import { useAssignSupervisor } from '../viewmodel/useAssignSupervisor';
import { useEmployees } from '../viewmodel/useEmployees';
import { SupervisorSearch } from './SupervisorSearch';
import { Toast } from './Toast';

export interface AssignSupervisorModalProps {
  employeeId: string;
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--hr-color-overlay)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  position: 'relative',
  width: 420,
  maxWidth: '100%',
  background: 'var(--hr-color-surface)',
  borderRadius: 'var(--hr-radius-lg)',
  padding: 28,
  fontFamily: 'var(--hr-font-family)',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'var(--hr-color-close-bg)',
  border: '1px solid var(--hr-color-close-border)',
  cursor: 'pointer',
  color: 'var(--hr-color-text-muted)',
  fontSize: 14,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// FEAT-3's "standalone assign action on the employee table row" — opened from EmployeesPage,
// reuses the same SupervisorSearch as RegisterEmployeeModal's inline supervisor field.
export function AssignSupervisorModal({
  employeeId,
  onClose,
}: AssignSupervisorModalProps) {
  const { employees } = useEmployees();
  const { assignSupervisor, loading, error, reset } = useAssignSupervisor();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showErrorToast, setShowErrorToast] = useState(false);

  function handleClose() {
    setSearch('');
    setSelectedId(null);
    setShowErrorToast(false);
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !employeeId) return;
    try {
      await assignSupervisor({ employeeId, supervisorId: selectedId });
      handleClose();
    } catch {
      setShowErrorToast(true);
    }
  }

  return (
    <div data-testid="assign-supervisor-modal" style={overlayStyle}>
      <div style={modalStyle}>
        <button
          type="button"
          data-testid="assign-supervisor-close"
          onClick={handleClose}
          style={closeButtonStyle}
        >
          ✕
        </button>

        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            margin: '0 0 20px 0',
            color: 'var(--hr-color-text)',
          }}
        >
          Assign Supervisor
        </h2>

        <form data-testid="assign-supervisor-form" onSubmit={handleSubmit}>
          <SupervisorSearch
            employees={employees}
            excludeId={employeeId}
            search={search}
            selectedId={selectedId}
            onSearchChange={setSearch}
            onSelect={(employee) => {
              setSelectedId(employee.id);
              setSearch(`${employee.firstName} ${employee.lastName}`);
            }}
            testIdPrefix="assign-supervisor"
          />

          <button
            type="submit"
            data-testid="assign-supervisor-submit"
            disabled={loading || !selectedId}
            style={{
              width: '100%',
              background: 'var(--hr-color-primary)',
              color: 'var(--hr-color-surface)',
              border: 'none',
              padding: 11,
              borderRadius: 'var(--hr-radius)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 18,
            }}
          >
            {loading ? 'Assigning…' : 'Assign'}
          </button>
        </form>
      </div>

      {showErrorToast && error ? (
        <Toast
          message={error.message}
          onDismiss={() => setShowErrorToast(false)}
        />
      ) : null}
    </div>
  );
}
