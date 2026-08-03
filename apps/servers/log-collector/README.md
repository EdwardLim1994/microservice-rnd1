# log-collector

Consumes every server's `log-events` Kafka topic (published by `LoggerPlugin`,
see `packages/server/src/plugin/LoggerPlugin.ts`) and pushes each event into
Loki — the structured-logging counterpart to Alloy's container-log tailing
(`services/monitoring`'s `alloy-config.alloy`), which only ever sees plain
stdout/stderr text.

No driver of its own (no gRPC/GraphQL port) — just a Kafka consumer and the
usual `HealthCheckPlugin` liveness port.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
