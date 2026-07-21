export interface ModalShellProps {
  testId: string;
  closeTestId: string;
  onClose: () => void;
  width?: number;
  scrollable?: boolean;
  children: React.ReactNode;
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

// Shared overlay/panel/close-button chrome for RegisterEmployeeModal and AssignSupervisorModal —
// extracted after the two modals independently duplicated the same styling.
export function ModalShell({
  testId,
  closeTestId,
  onClose,
  width = 480,
  scrollable = false,
  children,
}: ModalShellProps) {
  const modalStyle: React.CSSProperties = {
    position: 'relative',
    width,
    maxWidth: '100%',
    background: 'var(--hr-color-surface)',
    borderRadius: 'var(--hr-radius-lg)',
    padding: 28,
    fontFamily: 'var(--hr-font-family)',
    ...(scrollable ? { maxHeight: '90vh', overflowY: 'auto' } : {}),
  };

  return (
    <div data-testid={testId} style={overlayStyle}>
      <div style={modalStyle}>
        <button
          type="button"
          data-testid={closeTestId}
          onClick={onClose}
          style={closeButtonStyle}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
