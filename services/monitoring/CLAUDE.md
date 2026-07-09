# services/monitoring

Docker Compose stack: `prometheus` (metrics, `:9090`), `loki` (logs, `:3100`), `tempo` (traces,
`:3200`), `grafana` (dashboards, `:3002`) — the "LGTM" stack — plus `otel-collector` (`:4317`
grpc / `:4318` http), the single OTLP ingress every server/frontend points at.
`packages/server`'s `OtelPlugin` (see `packages/server/CLAUDE.md`) is the producer side; this
whole directory is the collection/storage/query/visualization side. There is no separate
`services/otel-collector/` directory — the collector is bundled in here, one Compose
project/Helm chart for the whole pipeline, per user direction.

## Ports

- Grafana is on `3002`, not the default `3000` — `apps/web1` already owns `3000` and
  `frontends/mfe1` already owns `3001` (see their own `docker-compose.yml`s).
- `otel-collector` owns the standard OTLP ports, `4317` (grpc) / `4318` (http) — this is
  `OtelPlugin`'s own default `OTEL_EXPORTER_OTLP_ENDPOINT` (`http://localhost:4317`), so a server
  using `OtelPlugin` with no config needs nothing beyond this stack being up.
- Tempo's own OTLP receivers are separately mapped to non-standard host ports (`4319`→`4317`
  grpc, `4320`→`4318` http) — kept for testing directly against Tempo, bypassing the collector
  entirely, without colliding with the collector's own `4317`/`4318`.

## otel-collector fans OTLP out to all three backends

`config/otel-collector-config.yaml` — one `otlp` receiver (grpc `4317`/http `4318`), three
pipelines:

- **traces** → `otlp/tempo` exporter (`tempo:4317`, plain OTLP passthrough — Tempo's own native
  receiver, see `config/tempo.yaml`).
- **metrics** → `prometheusremotewrite` exporter (`http://prometheus:9090/api/v1/write`) — not
  `otlp`, since Prometheus's own OTLP ingestion is a receiver-side feature
  (`--web.enable-otlp-receiver`, still on for direct/manual testing that bypasses the collector,
  see `docker-compose.yml`'s `prometheus` command) that the collector doesn't need; remote-write
  is the collector-side exporter Prometheus actually accepts pushes through.
- **logs** → `otlphttp/loki` exporter (`http://loki:3100/otlp`) — Loki's native OTLP log endpoint
  is `POST /otlp/v1/logs`; the `otlphttp` exporter appends `/v1/<signal>` itself, so the
  configured endpoint is the bare `/otlp` prefix, and this exporter is scoped to the logs pipeline
  only (it has no `/v1/traces`/`/v1/metrics` equivalent on Loki). Relevant once `OtelPlugin`'s
  logs signal exists (see `packages/server/CLAUDE.md`; not implemented yet, traces/metrics only
  today) — the pipeline is wired regardless, ready for when it lands.

Every server should point `OTEL_EXPORTER_OTLP_ENDPOINT` at `otel-collector:4317` (in-cluster) or
`http://localhost:4317` (docker-compose, `OtelPlugin`'s own default) — never at Tempo/Prometheus/
Loki directly, even though each still *can* accept OTLP on its own (kept for standalone testing of
this stack in isolation, not the intended production path).

## Grafana provisioning is declarative, not manual

`config/grafana/provisioning/datasources/datasources.yaml` auto-registers all three backends
(Prometheus as default, Loki, Tempo) on every container start — no clicking through the UI to
re-add data sources after a `docker compose down`. Tempo's data source config wires
`tracesToLogsV2`/`tracesToMetrics`/`serviceMap` to Loki/Prometheus by `uid` (`loki`/`prometheus`,
set explicitly in each data source's own `uid:` field, not Grafana's auto-generated one) — this is
what makes "jump from a trace span to its logs" work in Grafana's trace view.
`config/grafana/provisioning/dashboards/dashboards.yaml` registers an empty `json/` folder as a
dashboard provider — drop dashboard JSON exports in there to have them auto-load; none exist yet.

## Tempo's `metrics_generator` needs Prometheus's remote-write receiver

`config/tempo.yaml`'s `metrics_generator` (processors: `service-graphs`, `span-metrics`) derives
RED metrics and a service graph directly from ingested spans and remote-writes them into
Prometheus — this is what feeds Grafana's node graph / service map panels without hand-instrumenting
duplicate metrics for the same thing `OtelPlugin`'s tracing already captures. Requires
`--web.enable-remote-write-receiver` on the `prometheus` container (see `docker-compose.yml`).

## Healthchecks

`prometheus` and `loki` have Docker healthchecks (`wget --spider` against their own `/-/ready` /
`/ready` endpoints) — same "container up ≠ ready to serve" reasoning as every other `services/*`
stack (see `services/kafka/CLAUDE.md`). `tempo` and `grafana` don't — their images don't reliably
ship `wget`/`curl`, and `depends_on: ... condition: service_started` (not `service_healthy`) is
used for them accordingly; both have short startup windows in practice.

## Volumes are Compose-project-scoped, same caveat as every other services/* stack

`prometheus-data`/`loki-data`/`tempo-data`/`grafana-data` are named volumes scoped by Compose
**project name** — same caveat `services/meilisearch/CLAUDE.md`/`services/redis/CLAUDE.md`
document for their own data volumes. Always bring this stack up via the root `docker-compose.yml`
(which `include:`s this one), not standalone from inside `services/monitoring/`, or a server
reaching for `prometheus`/`loki`/`tempo`/`grafana` by hostname will find a different (empty)
instance than intended.

There is no application code in this folder — just the Docker Compose stack above, same as
`services/redis`, `services/kafka`, `services/meilisearch`, `services/adminer`, and
`services/apollo`.
