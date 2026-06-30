import { PrismaPg } from '@prisma/adapter-pg';
import { expect, test } from '@rstest/core';
import { PgAdapter } from '../../src/database/PgAdapter';

test('constructor accepts a connection string', () => {
  const adapter = new PgAdapter('postgresql://user:pass@localhost:5432/db');
  expect(adapter.adapter).toBeInstanceOf(PrismaPg);
});

test('constructor accepts a PoolConfig object', () => {
  const adapter = new PgAdapter({
    host: 'localhost',
    port: 5432,
    user: 'user',
    password: 'pass',
    database: 'db',
  });
  expect(adapter.adapter).toBeInstanceOf(PrismaPg);
});

test('adapter property is a PrismaPg instance', () => {
  const pg = new PgAdapter('postgresql://user:pass@localhost:5432/db');
  expect(pg.adapter).toBeInstanceOf(PrismaPg);
});
