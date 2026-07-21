// In-memory only — no reload persistence required by FEAT-4's scope (that would need a
// deliberate decision on where to store a bearer token safely, e.g. httpOnly cookie vs
// localStorage's XSS exposure, which is out of scope for "implement sign in").
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
