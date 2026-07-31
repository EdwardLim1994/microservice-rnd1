import { type AwilixContainer, asValue } from 'awilix';
import { BasePlugin } from '../abstract/BasePlugin';
import {
  bootstrapOtel,
  type OtelBootstrapConfig,
  type OtelHandles,
} from '../otel-bootstrap';

export type OtelPluginConfig = OtelBootstrapConfig;

export class OtelPlugin extends BasePlugin {
  private handles?: OtelHandles;

  /**
   * config comes from env vars only, same constraint as RedisPlugin/MeilisearchPlugin —
   * ServerApp.plugins() only ever calls `new Plugin(container)`, so `config`/`bootstrap` are
   * reachable directly (bypassing ServerApp) or from tests, never from `.plugins([OtelPlugin])`.
   *
   * `bootstrap` defaults to the same memoized bootstrapOtel() a server's index.ts should already
   * be calling *before* this plugin's onStart() ever runs (see otel-bootstrap.ts's own docs for
   * why the early call is the one that actually matters) — calling it again here is a cheap,
   * safe no-op past the first call, and still gives a server that skips the early-bootstrap
   * pattern a working (if late-instrumented) tracer/meter rather than nothing at all.
   */
  constructor(
    private readonly container: AwilixContainer,
    private readonly config: OtelPluginConfig = {},
    private readonly bootstrap: (
      config: OtelPluginConfig,
    ) => Promise<OtelHandles> = bootstrapOtel,
  ) {
    super();
  }

  /**
   * Starts the OTel SDK (does not eagerly verify the collector endpoint — a bad endpoint fails
   * silently on first export instead of failing startup) and registers `otelTracer`/`otelMeter`
   * into the container.
   */
  async onStart(): Promise<void> {
    this.handles = await this.bootstrap(this.config);
    this.container.register({
      otelTracer: asValue(this.handles.tracer),
      otelMeter: asValue(this.handles.meter),
    });
  }

  /** Flushes any buffered spans/metrics before shutdown. */
  async onStop(): Promise<void> {
    await this.handles?.sdk.shutdown();
  }
}
