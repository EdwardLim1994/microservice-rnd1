import { type AwilixContainer, asValue } from 'awilix';
import type { Client } from 'minio';
import { BasePlugin } from '../abstract/BasePlugin';

/**
 * 'minio' pulls in block-stream2 -> readable-stream, whose legacy `util.inherits(..., Readable)`
 * pattern crashes at module-load time under Bun on some platforms (confirmed on Bun 1.3.14/
 * arm64: "The superCtor.prototype property must be of type object") — not lazy before, which
 * meant any server importing anything from this package's barrel export (`export * from
 * './plugin'` etc.) ate that crash on startup even if it never registers MinioPlugin. Dynamic
 * import, same pattern as RedisPlugin's `await import('bun')`/OtelPlugin's `@opentelemetry/*`:
 * only a type-only import at module scope (erased at compile time), the real import lives inside
 * this factory, only reached if MinioPlugin is actually instantiated and started.
 */
async function createDefaultMinioClient(): Promise<Client> {
  const { Client: MinioClient } = await import('minio');
  return new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ROOT_USER ?? 'minioadmin',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'minioadmin',
  });
}

export class MinioPlugin extends BasePlugin {
  private client?: Client;

  /** factory param allows injection in tests without touching the real client, same pattern as MeilisearchPlugin/RedisPlugin */
  constructor(
    private readonly container: AwilixContainer,
    private readonly createClient: () => Promise<Client> = createDefaultMinioClient,
  ) {
    super();
  }

  /**
   * Eager health check — throws on bad host/credentials, failing server startup instead of
   * surfacing later on first bucket operation — then registers `minio` into the container.
   */
  async onStart(): Promise<void> {
    this.client = await this.createClient();
    await this.client.listBuckets();
    this.container.register({ minio: asValue(this.client) });
  }

  /** No-op — the minio client is stateless HTTP, nothing to close unlike Redis. */
  async onStop(): Promise<void> {}
}
