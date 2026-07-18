# Build context is this directory (services/debezium/kafka-connect) — see the "kafka-connect"
# service in services/debezium/docker-compose.yml. cp-kafka-connect already bundles Confluent's
# Avro converter (used below to match services/kafka's existing Avro/schema-registry convention);
# only the Debezium Postgres connector plugin itself needs installing. Pinned to a version known
# compatible with the cp-kafka-connect base below — bump both together.
FROM confluentinc/cp-kafka-connect:8.2.2

RUN confluent-hub install --no-prompt debezium/debezium-connector-postgresql:3.2.6-2

# Already the base image's own default — declared explicitly so static analysis doesn't have to
# guess (the plugin install above still runs as root, before this).
USER appuser
