
# services/kafka

Docker Compose stack: `kafka` (KRaft mode, single broker), `kafka-ui` (browser UI on `:8080`),
`schema-registry` (Confluent Schema Registry on `:8081`).

- `kafka` has two listeners: `PLAINTEXT` (`kafka:9092`, internal Docker network — what other
  containers must use) and `PLAINTEXT_HOST` (`localhost:29092`, host-machine access — what a
  locally-run `bun run index.ts` server must use). Mixing them (e.g. `kafka:29092`) half-works at
  best — the broker's metadata response for that port still advertises `localhost:29092`, so clients
  reconnect there and fail once inside a container.
- `kafka` and `schema-registry` both have Docker healthchecks
  (`kafka-broker-api-versions --bootstrap-server localhost:9092` / `curl .../subjects`) — a
  container being *up* isn't the same as the broker being *ready to serve requests*. Any service
  that depends on either should use `depends_on: <service>: condition: service_healthy`, not just
  `depends_on: <service>` (which only waits for the container to start, not warm up) — see
  `servers/demo1/docker-compose.yml` / `servers/demo2/docker-compose.yml` for the pattern.
- Topics are provisioned by `server`'s `KafkaDriver` (via `kafka.admin().createTopics()`, idempotent)
  before any producer/consumer connects — not by `KAFKA_AUTO_CREATE_TOPICS_ENABLE` alone, which
  races a consumer's first `subscribe()` and can crash it (`UNKNOWN_TOPIC_OR_PARTITION`) before the
  broker finishes auto-creating. See `packages/server/CLAUDE.md`'s KafkaDriver section.

There is no application code in this folder — just the Docker Compose stack above, same as
`services/adminer` and `services/apollo`.
