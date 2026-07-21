import { useState } from 'react';
import { EmployeesPage, RegisterEmployeeModal } from './modules/employee';

// The HR Admin role's signed-in landing page — split out from App.tsx so it can be exercised
// directly in tests without going through the full sign-in gate first.
export function HrAdminHome() {
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  return (
    <div className="content">
      <h1>hr-portal</h1>
      <button
        type="button"
        data-testid="open-register-employee-modal"
        onClick={() => setIsRegisterModalOpen(true)}
      >
        Register Employee
      </button>
      <RegisterEmployeeModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
      />
      <EmployeesPage />
    </div>
  );
}
