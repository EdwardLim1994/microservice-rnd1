import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { EmployeeRegistrationForm } from './components/EmployeeRegistrationForm';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { LeaveApprovalView } from './components/LeaveApprovalView';
import { LeaveRequestForm } from './components/LeaveRequestForm';
import { LoginPage } from './components/LoginPage';
import { LogoutButton } from './components/LogoutButton';
import { NotificationBell } from './components/NotificationBell';
import { PayslipPage } from './components/PayslipPage';
import { SetPasswordPage } from './components/SetPasswordPage';
import { getSession } from './lib/session';

// Every hr-portal route requires an active session (FEAT-16) except the ones a logged-out
// employee must reach to get one: /login, /forgot-password, /reset-password.
function requireSession() {
  if (!getSession()) {
    throw redirect({ to: '/login' });
  }
}

function requireSupervisor() {
  const session = getSession();
  if (!session) {
    throw redirect({ to: '/login' });
  }
  if (!session.isSupervisor) {
    throw redirect({ to: '/' });
  }
}

const rootRoute = createRootRoute({
  component: () => (
    <div>
      <nav>
        <NotificationBell />
        <LogoutButton />
      </nav>
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireSession,
  component: () => <h1>hr-portal</h1>,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => (
    <div>
      <h1>Log in</h1>
      <LoginPage />
    </div>
  ),
});

const employeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employees',
  beforeLoad: requireSession,
  component: () => (
    <div>
      <h1>Employees</h1>
      <EmployeeRegistrationForm />
    </div>
  ),
});

const leaveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leave',
  beforeLoad: requireSession,
  component: () => (
    <div>
      <h1>Leave</h1>
      <LeaveRequestForm />
    </div>
  ),
});

const leaveApprovalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leave/approvals',
  beforeLoad: requireSupervisor,
  component: () => (
    <div>
      <h1>Leave Approvals</h1>
      <LeaveApprovalView />
    </div>
  ),
});

const payslipsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/payslips',
  beforeLoad: requireSession,
  component: () => (
    <div>
      <h1>Payslips</h1>
      <PayslipPage />
    </div>
  ),
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: () => (
    <div>
      <h1>Forgot Password</h1>
      <ForgotPasswordPage />
    </div>
  ),
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: () => (
    <div>
      <h1>Set New Password</h1>
      <SetPasswordPage />
    </div>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  employeesRoute,
  leaveRoute,
  leaveApprovalsRoute,
  payslipsRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
