import { type AwilixContainer, asValue } from 'awilix';
import type { RedisClient } from 'bun';
import { BasePlugin } from '../abstract/BasePlugin';

/**
 * Bun's own Redis client — 'bun' is a builtin module, only resolvable when running under the
 * Bun runtime. Imported dynamically (not at module scope) so this file still loads under
 * rstest's Node-based test runner; the default factory below is only invoked when nothing is
 * injected in its place, which tests avoid by passing their own mock.
 */
async function createBunRedisClient(): Promise<RedisClient> {
  const { RedisClient: Ctor } = await import('bun');
  return new Ctor();
}

export class RedisPlugin extends BasePlugin {
  private client?: RedisClient;

  // ponytail: factory param allows injection in tests without touching the real client
  constructor(
    private readonly container: AwilixContainer,
    private readonly createClient: () => Promise<RedisClient> = createBunRedisClient,
  ) {
    super();
  }

  /** Connects eagerly (fails startup on a bad connection instead of surfacing later) and registers `redis` into the container. */
  async onStart(): Promise<void> {
    this.client = await this.createClient();
    await this.client.connect();
    this.container.register({ redis: asValue(this.client) });
  }

  /** Closes the Redis connection. */
  async onStop(): Promise<void> {
    this.client?.close();
  }
}
