import { expect, test } from '@rstest/core';
import { BaseDriver } from '../src/abstract/BaseDriver';
import { ServerApp } from '../src/ServerApp';

test('lib exports ServerApp', () => {
  expect(ServerApp).toBeDefined();
});

test('lib exports BaseDriver', () => {
  expect(BaseDriver).toBeDefined();
});
