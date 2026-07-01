import { type AwilixContainer, asClass } from 'awilix';
import { BaseRouter } from '../abstract/BaseRouter';
import type { BaseUseCase } from '../abstract/BaseUseCase';

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

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export abstract class KafkaConsumerRouter<
  TTopics extends Record<string, KafkaMessageType<any>>,
> extends BaseRouter {
  constructor(protected readonly container: AwilixContainer) {
    super();
  }

  // topic name -> protobuf message type, used to decode the raw Kafka message value
  abstract get topics(): TTopics;
  abstract get handlers(): KafkaHandlerMap<TTopics>;

  // topic name -> decode + resolve + execute, closing over this router's container
  // (same shape as GraphqlRouter.resolvers — auto-registers use cases transiently)
  get dispatchers(): Record<string, (payload: Uint8Array) => Promise<void>> {
    return Object.fromEntries(
      Object.entries(this.handlers).map(([topic, UseCase]) => {
        const token = lcFirst((UseCase as any).name);
        if (!this.container.hasRegistration(token)) {
          this.container.register({
            [token]: asClass(UseCase as any).transient(),
          });
        }

        const messageType = this.topics[topic];
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

  // ponytail: no-op — KafkaDriver reads topics/dispatchers directly, same as GraphqlRouter
  register(_consumer: unknown): void {}
}
