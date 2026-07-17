import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { EmployeeRegistrationForm } from './components/EmployeeRegistrationForm';
import { LeaveRequestForm } from './components/LeaveRequestForm';
import { NotificationBell } from './components/NotificationBell';

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

const routeTree = rootRoute.addChildren([
  indexRoute,
  employeesRoute,
  leaveRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
