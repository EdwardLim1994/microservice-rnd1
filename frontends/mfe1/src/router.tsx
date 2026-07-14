import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { LoginPage } from './modules/login';
import { LogoutPage } from './modules/logout';
import { RegisterPage } from './modules/register';
import { Test1Page } from './modules/test1';

const rootRoute = createRootRoute({
  component: () => (
    <div className="h-screen w-full">
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Test1Page,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const logoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logout',
  component: LogoutPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  registerRoute,
  loginRoute,
  logoutRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
