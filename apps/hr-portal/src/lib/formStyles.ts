// Shared form styling — lifted from the Claude Design HR Portal mockup's card-form styling,
// used identically (or with a small local override, e.g. padding) by every form-on-a-card screen
// in this app (RegisterEmployeeModal, LoginPage). Extracted after the same style objects were
// independently hand-copied into a second file.
export const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--hr-color-text-secondary)',
  display: 'block',
  marginBottom: 6,
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--hr-color-border)',
  borderRadius: 'var(--hr-radius)',
  fontSize: 14,
  fontFamily: 'inherit',
  marginBottom: 14,
};

export const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--hr-color-primary)',
  color: 'var(--hr-color-surface)',
  border: 'none',
  padding: 11,
  borderRadius: 'var(--hr-radius)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
