import { type AwilixContainer, asClass } from 'awilix';
import { BaseRouter } from '../abstract/BaseRouter';
import type { BaseUseCase } from '../abstract/BaseUseCase';
import type { KafkaSerializer } from '../kafka/KafkaSerializer';

// Matches ts-proto generated message objects (e.g. `Demo1Demo1Proto.Demo1`) — decode()
// is what turns a raw Kafka message value into a typed protobuf message. Also matches an
// async decode, e.g. a Confluent Schema Registry ProtobufDeserializer wrapped to this shape.
export interface KafkaMessageType<T> {
  decode(input: Uint8Array): T | Promise<T>;
}

export type KafkaHandlerMap<
  TTopics extends Record<string, KafkaMessageType<any>>,
> = {
  [K in keyof TTopics]: new (
    ...args: any[]
  ) => BaseUseCase<Awaited<ReturnType<TTopics[K]['decode']>>, void>;
};

// Maps a { topicName: tsProtoGeneratedMessage } declaration (the same shape used for
// KafkaDriverConfig.topics, e.g. { 'demo1.events': Demo1Demo1eventProto.Demo1Event }) to the
// KafkaMessageType<T> map a topic actually decodes to — each T inferred from that message's own
// decode() return type. This is what KafkaConsumerRouter.topics returns automatically.
export type DecodedTopics<
  TTopicTypes extends Record<string, KafkaMessageType<any>>,
> = {
  [K in keyof TTopicTypes]: KafkaMessageType<
    Awaited<ReturnType<TTopicTypes[K]['decode']>>
  >;
};

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// Every KafkaConsumerRouter decodes through a container-registered KafkaSerializer — Kafka
// messaging in this framework is protobuf + Schema Registry by convention (see
// packages/server/CLAUDE.md's Kafka serialization section), not a per-router choice. A router only
// declares which topics it consumes and what generated message type each one is; decoding itself
// is handled here, once, for every router.
export abstract class KafkaConsumerRouter<
  TTopicTypes extends Record<string, KafkaMessageType<any>>,
> extends BaseRouter {
  constructor(protected readonly container: AwilixContainer) {
    super();
  }

  // topic name -> generated protobuf message type (e.g. Demo1Demo1eventProto.Demo1Event) — only
  // used to enumerate topic names and infer each one's decoded type; the object's own decode() is
  // never called. `topics` (below) always decodes via the resolved KafkaSerializer instead.
  abstract get topicTypes(): TTopicTypes;
  abstract get handlers(): KafkaHandlerMap<TTopicTypes>;

  // Concrete — binds the container-registered kafkaSerializer's deserialize() to every topic in
  // topicTypes. Resolved lazily on each call, not cached from the constructor: KafkaDriver only
  // registers kafkaSerializer inside its own start(), which runs after every router is already
  // constructed (ServerApp.run() builds all routers up front) — resolving in the constructor
  // would throw.
  get topics(): DecodedTopics<TTopicTypes> {
    const serializer =
      this.container.resolve<KafkaSerializer>('kafkaSerializer');
    return Object.fromEntries(
      Object.keys(this.topicTypes).map((topic) => [
        topic,
        {
          decode: (payload: Uint8Array) =>
            serializer.deserialize(topic, payload),
        },
      ]),
    ) as DecodedTopics<TTopicTypes>;
  }

  // topic name -> decode + resolve + execute, closing over this router's container
  // (same shape as GraphqlRouter.resolvers — auto-registers use cases transiently)
  get dispatchers(): Record<string, (payload: Uint8Array) => Promise<void>> {
    const topics = this.topics;
    return Object.fromEntries(
      Object.entries(this.handlers).map(([topic, UseCase]) => {
        const token = lcFirst((UseCase as any).name);
        if (!this.container.hasRegistration(token)) {
          this.container.register({
            [token]: asClass(UseCase as any).transient(),
          });
        }

        const messageType = topics[topic];
        return [
          topic,
          async (payload: Uint8Array) => {
            const input = await messageType.decode(payload);
            const useCase =
              this.container.resolve<BaseUseCase<any, any>>(token);
            await useCase.execute(input);
          },
        ];
      }),
    );
  }
}
