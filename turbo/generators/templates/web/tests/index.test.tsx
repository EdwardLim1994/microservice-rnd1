import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { routeTree } from '../src/router';

function renderAtPath(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  return render(<RouterProvider router={router} />);
}

test('renders the home page', async () => {
  renderAtPath('/');
  expect(await screen.findByRole('heading', { name: 'Rsbuild with React' })).toBeInTheDocument();
});

test('renders the about page', async () => {
  renderAtPath('/about');
  expect(await screen.findByRole('heading', { name: 'About' })).toBeInTheDocument();
});
