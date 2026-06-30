import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolConfig } from 'pg';
import type { DbAdapter } from './DbAdapter';

export class PgAdapter implements DbAdapter {
  readonly adapter: PrismaPg;
  private readonly pool: Pool;

  constructor(config: PoolConfig | string) {
    this.pool =
      typeof config === 'string'
        ? new Pool({ connectionString: config })
        : new Pool(config);
    this.adapter = new PrismaPg(this.pool);
  }

  end(): Promise<void> {
    return this.pool.end();
  }
}
