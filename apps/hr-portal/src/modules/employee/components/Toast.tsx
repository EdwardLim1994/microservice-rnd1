export interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  return (
    <div
      data-testid="toast-error"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--hr-color-danger)',
        color: 'var(--hr-color-surface)',
        padding: '12px 18px',
        borderRadius: 'var(--hr-radius)',
        fontSize: 13,
        fontFamily: 'var(--hr-font-family)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 100,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        data-testid="toast-error-dismiss"
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        ✕
      </button>
    </div>
  );
}
