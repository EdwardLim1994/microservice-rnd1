import { type AwilixContainer, asValue } from 'awilix';
import { Client } from 'minio';
import { BasePlugin } from '../abstract/BasePlugin';

// 'minio' is a regular isomorphic (fetch/http-based) npm package, same as meilisearch's client —
// no dynamic import needed, loads fine under both Bun and rstest's Node runner, bundles normally
// through rslib.
function createDefaultMinioClient(): Client {
  return new Client({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ROOT_USER ?? 'minioadmin',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'minioadmin',
  });
}

export class MinioPlugin extends BasePlugin {
  private client?: Client;

  // factory param allows injection in tests without touching the real client, same pattern as MeilisearchPlugin/RedisPlugin
  constructor(
    private readonly container: AwilixContainer,
    private readonly createClient: () => Client = createDefaultMinioClient,
  ) {
    super();
  }

  /**
   * Eager health check — throws on bad host/credentials, failing server startup instead of
   * surfacing later on first bucket operation — then registers `minio` into the container.
   */
  async onStart(): Promise<void> {
    this.client = this.createClient();
    await this.client.listBuckets();
    this.container.register({ minio: asValue(this.client) });
  }

  /** No-op — the minio client is stateless HTTP, nothing to close unlike Redis. */
  async onStop(): Promise<void> {
    // stateless HTTP client — nothing to close, unlike Redis's persistent connection
  }
}
