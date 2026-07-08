import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', async () => {
  const testMessage = 'mfe1';
  render(<App />);
  // RouterProvider resolves its initial route asynchronously (even for a local, synchronous
  // route tree), so nothing is in the DOM yet right after render() — findByText retries until
  // it appears, unlike getByText which only checks once, synchronously.
  expect(await screen.findByText(testMessage)).toBeInTheDocument();
});
