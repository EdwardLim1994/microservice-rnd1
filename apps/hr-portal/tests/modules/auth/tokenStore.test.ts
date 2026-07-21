import { expect, test } from '@rstest/core';
import {
  getAccessToken,
  setAccessToken,
} from '../../../src/modules/auth/lib/tokenStore';

test('getAccessToken returns null before any token is set', () => {
  setAccessToken(null);
  expect(getAccessToken()).toBeNull();
});

test('setAccessToken stores a token retrievable via getAccessToken', () => {
  setAccessToken('a-token');
  expect(getAccessToken()).toBe('a-token');
  setAccessToken(null);
});
