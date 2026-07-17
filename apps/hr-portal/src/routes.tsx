import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { EmployeeRegistrationForm } from './components/EmployeeRegistrationForm';
import { LeaveApprovalView } from './components/LeaveApprovalView';
import { LeaveRequestForm } from './components/LeaveRequestForm';
import { NotificationBell } from './components/NotificationBell';
import { PayslipPage } from './components/PayslipPage';

const rootRoute = createRootRoute({
  component: () => (
    <div>
      <nav>
        <NotificationBell />
      </nav>
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <h1>hr-portal</h1>,
});

const employeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employees',
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
  component: () => (
    <div>
      <h1>Payslips</h1>
      <PayslipPage />
    </div>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  employeesRoute,
  leaveRoute,
  leaveApprovalsRoute,
  payslipsRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
