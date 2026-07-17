import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', async () => {
  const testMessage = 'hr-portal';
  render(<App />);
  // @tanstack/react-router resolves the initial route asynchronously — findByText retries
  // instead of asserting on the first (pre-router-resolution) paint.
  expect(await screen.findByText(testMessage)).toBeInTheDocument();
});
