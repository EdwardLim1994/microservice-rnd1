import { expect, test } from '@rstest/core';
import {
  buildAuthHeaders,
  createApolloClient,
} from '../../src/lib/apolloClient';
import { setAccessToken } from '../../src/modules/auth/lib/tokenStore';

test('buildAuthHeaders adds no authorization header when no token is set', () => {
  setAccessToken(null);
  expect(buildAuthHeaders({ 'x-existing': 'value' })).toEqual({
    'x-existing': 'value',
  });
});

test('buildAuthHeaders adds a Bearer authorization header when a token is set', () => {
  setAccessToken('my-token');
  expect(buildAuthHeaders({ 'x-existing': 'value' })).toEqual({
    'x-existing': 'value',
    authorization: 'Bearer my-token',
  });
  setAccessToken(null);
});

test('createApolloClient returns a configured ApolloClient', () => {
  const client = createApolloClient('http://localhost:4000/graphql');
  expect(client).toBeDefined();
});
