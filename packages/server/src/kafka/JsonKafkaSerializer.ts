import type { KafkaSerializer } from './KafkaSerializer';

/**
 * Plain-JSON KafkaSerializer — no Schema Registry, no protobuf. Debezium Server's default sink
 * format (debezium.format.value.type, unset) is a bare JSON string per message, unlike this
 * repo's app-level topics (SchemaRegistryKafkaSerializer, protobuf + Confluent/Apicurio).
 * A consumer-only server (no kafkaProducer.send of its own) never calls serialize(), but the
 * KafkaSerializer interface requires both directions of one shared strategy.
 */
export class JsonKafkaSerializer implements KafkaSerializer {
  async serialize(_topic: string, value: unknown): Promise<Buffer> {
    return Buffer.from(JSON.stringify(value));
  }

  async deserialize<T>(_topic: string, payload: Uint8Array): Promise<T> {
    return JSON.parse(Buffer.from(payload).toString('utf-8')) as T;
  }
}
