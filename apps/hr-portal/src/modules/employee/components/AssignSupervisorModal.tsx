import { useState } from 'react';
import type { Employee } from '../types/repository';
import { useAssignSupervisor } from '../viewmodel/useAssignSupervisor';
import { ModalShell } from './ModalShell';
import { SupervisorSearch } from './SupervisorSearch';
import { Toast } from './Toast';

export interface AssignSupervisorModalProps {
  employeeId: string;
  employees: Employee[];
  onClose: () => void;
}

// FEAT-3's "standalone assign action on the employee table row" — opened from EmployeesPage,
// reuses the same SupervisorSearch as RegisterEmployeeModal's inline supervisor field.
// `employees` is passed down from EmployeesPage (which already has it loaded) rather than
// queried again here, since this modal only ever opens once that list has already loaded.
export function AssignSupervisorModal({
  employeeId,
  employees,
  onClose,
}: AssignSupervisorModalProps) {
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
    if (!selectedId) return;
    try {
      await assignSupervisor({ employeeId, supervisorId: selectedId });
      handleClose();
    } catch {
      setShowErrorToast(true);
    }
  }

  return (
    <>
      <ModalShell
        testId="assign-supervisor-modal"
        closeTestId="assign-supervisor-close"
        onClose={handleClose}
        width={420}
      >
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
            onSearchChange={(value) => {
              // Editing the search text after a selection invalidates that selection — clear
              // selectedId too, or submit would silently use a stale supervisor.
              setSearch(value);
              setSelectedId(null);
            }}
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
      </ModalShell>

      {showErrorToast && error ? (
        <Toast
          message={error.message}
          onDismiss={() => setShowErrorToast(false)}
        />
      ) : null}
    </>
  );
}
