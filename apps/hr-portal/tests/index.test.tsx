import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the login page by default', () => {
  render(<App />);
  expect(screen.getByTestId('login-page')).toBeInTheDocument();
});
