import type { AwilixContainer } from 'awilix';

/**
 * Wraps `fn` in a SERVER-kind span via the container's `otelTracer` (registered by OtelPlugin's
 * onStart(), see plugin/OtelPlugin.ts) — a plain passthrough if no tracer is registered, since
 * GrpcRouter/GraphqlRouter are used by every server, not just ones with OtelPlugin in their own
 * `.plugins([...])` list.
 *
 * Manual instrumentation, not @opentelemetry/instrumentation-grpc's/-graphql's automatic hooks —
 * those patch the `@grpc/grpc-js`/`graphql` modules via Node's CommonJS require-hook
 * (require-in-the-middle), which doesn't reliably intercept anything under Bun's own module
 * loader. Confirmed empirically: a server with OtelPlugin wired and bootstrapOtel() called at the
 * documented earliest point still produced zero spans for real gRPC/GraphQL requests, while a
 * span created directly through this same container's otelTracer reached the collector and Tempo
 * fine. This is the actual, working instrumentation path until Bun's require-hook compatibility
 * improves (or auto-instrumentation is dropped from otel-bootstrap.ts entirely).
 *
 * `@opentelemetry/api` is imported dynamically, not at module scope — same reason as
 * otel-bootstrap.ts's own dynamic imports (see that file's big comment): its "module" exports
 * condition points at an ESM build with extensionless relative imports that rstest's Node-based
 * resolver can't follow, throwing "Cannot find module" the moment anything imports it statically.
 */
export async function withServerSpan<T>(
  container: AwilixContainer,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!container.hasRegistration('otelTracer')) return fn();

  const { SpanKind, SpanStatusCode } = await import('@opentelemetry/api');
  const tracer = container.resolve(
    'otelTracer',
  ) as import('@opentelemetry/api').Tracer;
  return tracer.startActiveSpan(name, { kind: SpanKind.SERVER }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (err as Error).message,
      });
      throw err;
    } finally {
      span.end();
    }
  });
}
