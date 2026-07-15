import { type AwilixContainer, asValue } from 'awilix';
import { MeiliSearch } from 'meilisearch';
import { BasePlugin } from '../abstract/BasePlugin';

// 'meilisearch' is a regular isomorphic (fetch-based) npm package, unlike Bun's builtin
// RedisClient — no dynamic import needed, this loads fine under both Bun and rstest's Node
// runner, and bundles normally through rslib.
function createDefaultMeilisearchClient(): MeiliSearch {
  return new MeiliSearch({
    host: process.env.MEILISEARCH_HOST ?? 'http://localhost:7700',
    apiKey: process.env.MEILISEARCH_API_KEY,
  });
}

export class MeilisearchPlugin extends BasePlugin {
  private client?: MeiliSearch;

  // factory param allows injection in tests without touching the real client, same pattern as RedisPlugin
  constructor(
    private readonly container: AwilixContainer,
    private readonly createClient: () => MeiliSearch = createDefaultMeilisearchClient,
  ) {
    super();
  }

  /**
   * Eager health check — throws on a bad host/key, failing server startup instead of surfacing
   * later on first search request — then registers `meilisearch` into the container.
   */
  async onStart(): Promise<void> {
    this.client = this.createClient();
    // eager health check — throws on a bad host/key, failing server startup instead of
    // surfacing later on first search request (same rationale as RedisPlugin's eager .connect()
    // and ServerApp.database()'s eager $connect())
    await this.client.health();
    this.container.register({ meilisearch: asValue(this.client) });
  }

  /** No-op — Meilisearch's client is stateless HTTP, nothing to close unlike Redis. */
  async onStop(): Promise<void> {
    // stateless HTTP client — nothing to close, unlike Redis's persistent connection
  }
}
