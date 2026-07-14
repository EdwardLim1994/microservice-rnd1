import path from 'node:path';
import 'dotenv/config';
import { defineConfig, env, type PrismaConfig } from 'prisma/config';

export interface CreatePrismaConfigOptions {
  schemaDir?: string;
  databaseUrlEnv?: string;
}

export function createPrismaConfig({
  schemaDir = path.join('src', 'schemas', 'prisma'),
  databaseUrlEnv = 'DATABASE_URL',
}: CreatePrismaConfigOptions = {}): PrismaConfig {
  return defineConfig({
    schema: path.join(schemaDir, 'schema.prisma'),
    migrations: {
      path: path.join(schemaDir, 'migrations'),
    },
    datasource: {
      url: env(databaseUrlEnv),
    },
  });
}
