import { expect, test } from '@rstest/core';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { routeTree } from '../src/router';

// Builds an isolated router per test (memory history, chosen starting location) rather than
// rendering App/HomePage directly — HomePage lazy-loads the mfe1 Module Federation remote, which
// only resolves through a running dev server's federation runtime, not this test's environment.
function renderAtPath(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

test('renders the about page', async () => {
  renderAtPath('/about');
  expect(
    await screen.findByRole('heading', { name: 'About' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Sample page routed with @tanstack/react-router.'),
  ).toBeInTheDocument();
});

test('nav links point at the registered routes', async () => {
  renderAtPath('/about');
  expect(await screen.findByRole('link', { name: 'Home' })).toHaveAttribute(
    'href',
    '/',
  );
  expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
    'href',
    '/about',
  );
});
