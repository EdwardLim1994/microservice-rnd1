import type { Meter, Tracer } from '@opentelemetry/api';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import type { NodeSDK } from '@opentelemetry/sdk-node';

export interface OtelBootstrapConfig {
  serviceName?: string;
  /**
   * Collector endpoint for both traces and metrics — this framework standardizes every server on
   * OTLP/gRPC (not OTLP/HTTP), since the Collector's receiver listens on both ports simultaneously
   * and there's no reason for server-to-server inconsistency; only the browser side (which can't
   * speak gRPC) needs OTLP/HTTP.
   */
  otlpEndpoint?: string;
  metricExportIntervalMillis?: number;
  /**
   * Defaults instrument exactly this framework's own protocol surface (gRPC, GraphQL, Kafka) —
   * not @opentelemetry/auto-instrumentations-node's much larger bundle of every Node core
   * module/HTTP client, most of which this framework never touches directly. Only usable through
   * bootstrapOtel below, since instrumentation instances aren't serializable across the
   * dynamic-import boundary — pass pre-built instances here.
   */
  instrumentations?: Instrumentation[];
}

export interface OtelHandles {
  sdk: Pick<NodeSDK, 'shutdown'>;
  tracer: Tracer;
  meter: Meter;
}

function resolveServiceName(config: OtelBootstrapConfig): string {
  return (
    config.serviceName ?? process.env.OTEL_SERVICE_NAME ?? 'unknown-service'
  );
}

function resolveOtlpEndpoint(config: OtelBootstrapConfig): string {
  return (
    config.otlpEndpoint ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    'http://localhost:4317'
  );
}

let cached: Promise<OtelHandles> | undefined;

/**
 * Starts the OTel SDK (traces + metrics + gRPC/GraphQL/Kafka auto-instrumentation) exactly once
 * per process — memoized, so calling it more than once (e.g. once early from a server's own
 * index.ts, once again from OtelPlugin.onStart() further down the same boot sequence) is safe
 * and just returns the same handles.
 *
 * Import this from "server/otel" (this file's own build entry), not "server" (the main entry),
 * and call it from a server's index.ts *before* importing ./src/app — confirmed the hard way
 * that importing/calling it any later never produces a single span, despite the OTel SDK itself
 * starting up with no errors:
 *
 * @opentelemetry/instrumentation-grpc and -graphql patch the `@grpc/grpc-js`/`graphql` modules
 * via a require-hook that only intercepts modules not yet loaded into the process — but
 * ApolloDriver.ts/GrpcDriver.ts (in this same package) import those modules at their own
 * module-top-level, and packages/server's rslib build bundles the *entire* package into one
 * dist/index.js. That means the moment anything imports from "server" (the main entry) — even
 * just to grab this very function — rslib's bundle already pulled ApolloDriver.ts/GrpcDriver.ts
 * (and therefore `graphql`/`@grpc/grpc-js`) into that same file's top-level import graph, which
 * finishes evaluating before any function *inside* that file (including this one) ever runs.
 * Calling bootstrapOtel() sooner in the same file doesn't help — the patch is already too late by
 * the time you're able to call anything. This file is its own separate build entry (see
 * rslib.config.ts's second `lib` array entry and package.json's "./otel" export) specifically so
 * that importing it pulls in *only* this file's own graph — zero imports of ./driver or anything
 * else that touches graphql/@grpc-js — letting the instrumentation patch land before those
 * modules ever load anywhere in the process.
 */
export function bootstrapOtel(
  config: OtelBootstrapConfig = {},
): Promise<OtelHandles> {
  if (!cached) cached = createOtel(config);
  return cached;
}

/**
 * All @opentelemetry/* packages are imported dynamically, not at module scope — some of them
 * (e.g. @opentelemetry/api) publish a custom "module" exports condition pointing at an ESM build
 * with extensionless relative imports (e.g. `./baggage/utils`, no `.js`); Rspack's own
 * bundler-time resolver tolerates that fine, but rstest's Node-based test runner resolves it via
 * the runtime's strict ESM resolver and throws "Cannot find module". Same rationale/pattern as
 * RedisPlugin's lazy `await import('bun')`.
 */
async function createOtel(config: OtelBootstrapConfig): Promise<OtelHandles> {
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
