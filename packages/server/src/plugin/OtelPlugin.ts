import type { Meter, Tracer } from '@opentelemetry/api';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import type { NodeSDK } from '@opentelemetry/sdk-node';
import { type AwilixContainer, asValue } from 'awilix';
import { BasePlugin } from '../abstract/BasePlugin';

export interface OtelPluginConfig {
  serviceName?: string;
  // Collector endpoint for both traces and metrics — this framework standardizes every server on
  // OTLP/gRPC (not OTLP/HTTP), since the Collector's receiver listens on both ports simultaneously
  // and there's no reason for server-to-server inconsistency; only the browser side (which can't
  // speak gRPC) needs OTLP/HTTP.
  otlpEndpoint?: string;
  metricExportIntervalMillis?: number;
  // Defaults instrument exactly this framework's own protocol surface (gRPC, GraphQL, Kafka) —
  // not @opentelemetry/auto-instrumentations-node's much larger bundle of every Node core
  // module/HTTP client, most of which this framework never touches directly. Only usable through
  // createDefaultOtel below, since instrumentation instances aren't serializable across the
  // dynamic-import boundary — pass pre-built instances here.
  instrumentations?: Instrumentation[];
}

interface OtelHandles {
  sdk: Pick<NodeSDK, 'shutdown'>;
  tracer: Tracer;
  meter: Meter;
}

function resolveServiceName(config: OtelPluginConfig): string {
  return (
    config.serviceName ?? process.env.OTEL_SERVICE_NAME ?? 'unknown-service'
  );
}

function resolveOtlpEndpoint(config: OtelPluginConfig): string {
  return (
    config.otlpEndpoint ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    'http://localhost:4317'
  );
}

// All @opentelemetry/* packages are imported dynamically, not at module scope — some of them
// (e.g. @opentelemetry/api) publish a custom "module" exports condition pointing at an ESM build
// with extensionless relative imports (e.g. `./baggage/utils`, no `.js`); Rspack's own
// bundler-time resolver tolerates that fine, but rstest's Node-based test runner resolves it via
// the runtime's strict ESM resolver and throws "Cannot find module". Same rationale/pattern as
// RedisPlugin's lazy `await import('bun')`: only type-only imports at module scope (erased at
// compile time, so loading this file never touches the real packages), and the real import lives
// inside this factory, which tests never invoke because they inject their own mock in its place.
async function createDefaultOtel(
  config: OtelPluginConfig,
): Promise<OtelHandles> {
  const [
    { trace, metrics },
    { NodeSDK },
    { PeriodicExportingMetricReader },
    { resourceFromAttributes },
    { ATTR_SERVICE_NAME },
    { OTLPTraceExporter },
    { OTLPMetricExporter },
    { GrpcInstrumentation },
    { GraphQLInstrumentation },
    { KafkaJsInstrumentation },
  ] = await Promise.all([
    import('@opentelemetry/api'),
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/sdk-metrics'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/semantic-conventions'),
    import('@opentelemetry/exporter-trace-otlp-grpc'),
    import('@opentelemetry/exporter-metrics-otlp-grpc'),
    import('@opentelemetry/instrumentation-grpc'),
    import('@opentelemetry/instrumentation-graphql'),
    import('@opentelemetry/instrumentation-kafkajs'),
  ]);

  const serviceName = resolveServiceName(config);
  const otlpEndpoint = resolveOtlpEndpoint(config);

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
    traceExporter: new OTLPTraceExporter({ url: otlpEndpoint }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: otlpEndpoint }),
        exportIntervalMillis: config.metricExportIntervalMillis ?? 60_000,
      }),
    ],
    instrumentations: config.instrumentations ?? [
      new GrpcInstrumentation(),
      new GraphQLInstrumentation(),
      new KafkaJsInstrumentation(),
    ],
  });
  // NodeSDK#start() is synchronous — it registers providers with the OTel API and returns
  // immediately, it doesn't establish the OTLP connection eagerly the way RedisPlugin/
  // MeilisearchPlugin's onStart() does, so a bad collector endpoint doesn't fail server startup;
  // it just fails silently on the first export attempt (batched/periodic by design).
  sdk.start();

  return {
    sdk,
    tracer: trace.getTracer(serviceName),
    meter: metrics.getMeter(serviceName),
  };
}

export class OtelPlugin extends BasePlugin {
  private handles?: OtelHandles;

  // config comes from env vars only, same constraint as RedisPlugin/MeilisearchPlugin —
  // ServerApp.plugins() only ever calls `new Plugin(container)`, so `config`/`createOtel` are
  // reachable directly (bypassing ServerApp) or from tests, never from `.plugins([OtelPlugin])`.
  constructor(
    private readonly container: AwilixContainer,
    private readonly config: OtelPluginConfig = {},
    private readonly createOtel: (
      config: OtelPluginConfig,
    ) => Promise<OtelHandles> = createDefaultOtel,
  ) {
    super();
  }

  async onStart(): Promise<void> {
    this.handles = await this.createOtel(this.config);
    this.container.register({
      otelTracer: asValue(this.handles.tracer),
      otelMeter: asValue(this.handles.meter),
    });
  }

  async onStop(): Promise<void> {
    await this.handles?.sdk.shutdown();
  }
}
