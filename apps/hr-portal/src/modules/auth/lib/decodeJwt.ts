export interface JwtClaims {
  groups?: string[];
  [claim: string]: unknown;
}

// Decodes (never verifies) a JWT's payload — used purely to read the `groups` claim for
// client-side role-based routing. Not a trust boundary: every actual data request still goes
// through Apollo Router/the owning subgraph, which is what enforces real authorization.
export function decodeJwt(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(
      base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export type EmployeeRole = 'hr-admin' | 'supervisor' | 'employee';

export function resolveRole(claims: JwtClaims | null): EmployeeRole {
  const groups = claims?.groups ?? [];
  if (groups.includes('hr-admin')) return 'hr-admin';
  if (groups.includes('supervisor')) return 'supervisor';
  return 'employee';
}
