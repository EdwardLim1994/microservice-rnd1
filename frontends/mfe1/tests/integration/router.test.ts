import { expect, test } from '@rstest/core';
import { LogoutPage } from '../../src/modules/logout';
import { router } from '../../src/router';

test('registers a /logout route rendering LogoutPage', () => {
  const route = router.routesByPath['/logout'];
  expect(route).toBeDefined();
  expect(route.options.component).toBe(LogoutPage);
});
