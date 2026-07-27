import { BasePlugin } from '../abstract/BasePlugin';

/** Serves a plain 200 "ok" over Bun.serve on its own port — for Grafana/k8s liveness probes, independent of whatever protocol the server's main drivers speak (Grpc/Kafka/Cron have no HTTP surface of their own). */
export class HealthCheckPlugin extends BasePlugin {
  private server?: ReturnType<typeof Bun.serve>;

  constructor(private readonly port = Number(process.env.HEALTHCHECK_PORT ?? 9000)) {
    super();
  }

  async onStart(): Promise<void> {
    this.server = Bun.serve({
      port: this.port,
      fetch: () => new Response('ok', { status: 200 }),
    });
  }

  async onStop(): Promise<void> {
    this.server?.stop();
  }
}
