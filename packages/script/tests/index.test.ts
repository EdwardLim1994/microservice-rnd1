import { expect, test } from '@rstest/core';
import { APIGenerator } from '../src/index';

test('script exports APIGenerator', () => {
  expect(APIGenerator).toBeDefined();
});
