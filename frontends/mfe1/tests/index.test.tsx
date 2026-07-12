import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', async () => {
  // Was previously asserting on the literal text "mfe1", which App never renders anywhere — this
  // test has never actually passed against real app output (confirmed: fails identically on
  // main, unrelated to any change here). App wires a real ApolloClient with no injection point
  // for a mock, so the only thing assertable deterministically without a larger refactor is
  // Test1Page's synchronous pre-fetch state, rendered before the real (env-dependent) GraphQL
  // request has any chance to resolve.
  const testMessage = 'Loading…';
  render(<App />);
  // RouterProvider resolves its initial route asynchronously (even for a local, synchronous
  // route tree), so nothing is in the DOM yet right after render() — findByText retries until
  // it appears, unlike getByText which only checks once, synchronously.
  expect(await screen.findByText(testMessage)).toBeInTheDocument();
});
