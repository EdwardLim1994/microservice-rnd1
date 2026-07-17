// ponytail: no dedicated session store — three localStorage keys are the whole session. Every
// other component in this app already reads 'currentEmployeeId' from localStorage directly (see
// NotificationBell/LeaveRequestForm/etc.'s own stub-auth fallback) — this file is the first place
// that actually *writes* it, via a real login instead of a manually-seeded value.
const EMPLOYEE_ID_KEY = 'currentEmployeeId';
const IS_SUPERVISOR_KEY = 'isSupervisor';
const ACCESS_TOKEN_KEY = 'accessToken';

export interface Session {
  employeeId: string;
  isSupervisor: boolean;
  accessToken: string;
}

export function getSession(): Session | null {
  const employeeId = globalThis.localStorage?.getItem(EMPLOYEE_ID_KEY);
  const accessToken = globalThis.localStorage?.getItem(ACCESS_TOKEN_KEY);
  if (!employeeId || !accessToken) return null;
  return {
    employeeId,
    accessToken,
    isSupervisor:
      globalThis.localStorage?.getItem(IS_SUPERVISOR_KEY) === 'true',
  };
}

export function setSession(session: Session): void {
  globalThis.localStorage?.setItem(EMPLOYEE_ID_KEY, session.employeeId);
  globalThis.localStorage?.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  globalThis.localStorage?.setItem(
    IS_SUPERVISOR_KEY,
    String(session.isSupervisor),
  );
}

export function clearSession(): void {
  globalThis.localStorage?.removeItem(EMPLOYEE_ID_KEY);
  globalThis.localStorage?.removeItem(ACCESS_TOKEN_KEY);
  globalThis.localStorage?.removeItem(IS_SUPERVISOR_KEY);
}
