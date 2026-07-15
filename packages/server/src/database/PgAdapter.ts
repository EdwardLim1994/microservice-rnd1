import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolConfig } from 'pg';
import type { DbAdapter } from './DbAdapter';

export class PgAdapter implements DbAdapter {
  readonly adapter: PrismaPg;
  private readonly pool: Pool;

  /** Accepts either a connection string or a full `pg` `PoolConfig` object. */
  constructor(config: PoolConfig | string) {
    this.pool =
      typeof config === 'string'
        ? new Pool({ connectionString: config })
        : new Pool(config);
    this.adapter = new PrismaPg(this.pool);
  }

  /** Closes the underlying `pg` pool. */
  end(): Promise<void> {
    return this.pool.end();
  }
}
