import { BasePlugin } from '../abstract/BasePlugin';

/** Serves a 200 over Bun.serve on its own port — for k8s liveness probes (body ignored) and Prometheus scraping (body is valid exposition format, so the scrape's own `up{job=...}` becomes the Grafana healthcheck signal), independent of whatever protocol the server's main drivers speak (Grpc/Kafka/Cron have no HTTP surface of their own). */
export class HealthCheckPlugin extends BasePlugin {
  private server?: ReturnType<typeof Bun.serve>;

  constructor(
    private readonly port = Number(process.env.HEALTHCHECK_PORT ?? 9000),
  ) {
    super();
  }

  async onStart(): Promise<void> {
    this.server = Bun.serve({
      port: this.port,
      fetch: () => new Response('up 1\n', { status: 200 }),
    });
  }

  async onStop(): Promise<void> {
    this.server?.stop();
  }
}
