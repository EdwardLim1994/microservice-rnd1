import { create, type DescMessage } from '@bufbuild/protobuf';
import {
  ProtobufDeserializer,
  ProtobufSerializer,
  SchemaRegistryClient,
  SerdeType,
} from '@confluentinc/schemaregistry';
import type { KafkaMessageType } from '../router/KafkaRouter';
import type { KafkaSerializer } from './KafkaSerializer';

// Subsets actually used here — lets tests inject fakes instead of hitting a real Schema
// Registry over the network.
export interface ProtobufSerializerLike {
  registry: { add(schema: DescMessage): void };
  serialize(topic: string, message: unknown): Promise<Buffer>;
}
export interface ProtobufDeserializerLike {
  deserialize(topic: string, payload: Buffer): Promise<unknown>;
}

export interface SchemaRegistryKafkaSerializerConfig {
  // topic -> protobuf-es generated schema (e.g. Demo1ProtobufEs.Demo1Schema) — only required for
  // topics this instance *produces* to (registered up front so a produce fails fast if the
  // message shape is no longer BACKWARD-compatible). A topic only ever consumed via
  // deserialize()/decoder() needs no schema here — ProtobufDeserializer fetches whatever schema
  // the producer actually registered, by the ID embedded in the message's wire format.
  schemas?: Record<string, DescMessage>;
  registryUrl?: string;
}

// One Schema Registry client backs both directions — a server that only produces or only
// consumes simply never calls the other method, but a server doing both (unusual, but not
// disallowed) shares a single client/cache instead of standing up two.
export class SchemaRegistryKafkaSerializer implements KafkaSerializer {
  private readonly serializer: ProtobufSerializerLike;
  private readonly deserializer: ProtobufDeserializerLike;

  // ponytail: factory params allow injection in tests without touching the real Schema Registry
  // client or @bufbuild/protobuf's create() — same testability pattern as KafkaDriver's createKafka.
  constructor(
    private readonly config: SchemaRegistryKafkaSerializerConfig = {},
    private readonly createMessage: (
      schema: DescMessage,
      value: unknown,
    ) => unknown = create as (schema: DescMessage, value: unknown) => unknown,
    createSerde: () => {
      serializer: ProtobufSerializerLike;
      deserializer: ProtobufDeserializerLike;
    } = () => {
      const client = SchemaRegistryClient.newClient({
        baseURLs: [
          config.registryUrl ??
            process.env.SCHEMA_REGISTRY_URL ??
            'http://localhost:8081',
        ],
      });
      return {
        serializer: new ProtobufSerializer(client, SerdeType.VALUE, {
          autoRegisterSchemas: true,
        }),
        deserializer: new ProtobufDeserializer(client, SerdeType.VALUE, {}),
      };
    },
  ) {
    const { serializer, deserializer } = createSerde();
    this.serializer = serializer;
    this.deserializer = deserializer;
    for (const schema of Object.values(config.schemas ?? {})) {
      this.serializer.registry.add(schema);
    }
  }

  async serialize(topic: string, value: unknown): Promise<Buffer> {
    const schema = this.config.schemas?.[topic];
    if (!schema) {
      throw new Error(
        `SchemaRegistryKafkaSerializer: no schema registered for topic "${topic}"`,
      );
    }

    const message = this.createMessage(schema, value);
    return this.serializer.serialize(topic, message);
  }

  async deserialize<T>(topic: string, payload: Uint8Array): Promise<T> {
    return this.deserializer.deserialize(
      topic,
      Buffer.from(payload),
    ) as Promise<T>;
  }

  // Binds this serializer's deserialize() to one topic, matching KafkaMessageType<T> so it drops
  // straight into a KafkaConsumerRouter's topics map.
  decoder<T>(topic: string): KafkaMessageType<T> {
    return { decode: (payload) => this.deserialize<T>(topic, payload) };
  }
}
