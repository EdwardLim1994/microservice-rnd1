import { asValue } from 'awilix';
import { type Consumer, Kafka, type KafkaConfig, type Producer } from 'kafkajs';
import { BaseDriver, type DriverStartOptions } from '../abstract/BaseDriver';
import type { KafkaMessageType } from '../router/KafkaRouter';

interface KafkaConsumerRouterShape {
  topics: Record<string, unknown>;
  dispatchers: Record<string, (payload: Uint8Array) => Promise<void>>;
}

function isKafkaConsumerRouter(
  router: unknown,
): router is KafkaConsumerRouterShape {
  return (
    typeof router === 'object' &&
    router !== null &&
    'topics' in router &&
    'dispatchers' in router
  );
}

export interface KafkaDriverConfig {
  brokers?: string[];
  clientId?: string;
  groupId?: string;
  // Topics this server produces to but doesn't consume (e.g. demo1, which has no
  // KafkaConsumerRouter) — provisioned alongside whatever routers declare, so a
  // producer-only server doesn't race the broker's auto-create on first send().
  topics?: Record<string, KafkaMessageType<unknown>>;
}

export class KafkaDriver extends BaseDriver {
  private producer?: Producer;
  private consumer?: Consumer;

  // ponytail: factory param allows injection in tests without touching the real client
  constructor(
    private readonly config: KafkaDriverConfig = {},
    private readonly createKafka: (kafkaConfig: KafkaConfig) => Kafka = (
      kafkaConfig,
    ) => new Kafka(kafkaConfig),
  ) {
    super();
  }

  async start({ routers, container }: DriverStartOptions): Promise<void> {
    const brokers =
      this.config.brokers ??
      (process.env.KAFKA_BROKERS ?? 'localhost:29092').split(',');
    const clientId = this.config.clientId ?? process.env.KAFKA_CLIENT_ID;
    const groupId =
      this.config.groupId ?? process.env.KAFKA_GROUP_ID ?? 'default-group';

    const kafka = this.createKafka({ brokers, clientId });

    const dispatch: Record<string, (payload: Uint8Array) => Promise<void>> = {};
    for (const router of routers) {
      if (!isKafkaConsumerRouter(router)) continue;
      Object.assign(dispatch, router.dispatchers);
    }
    const consumerTopics = Object.keys(dispatch);

    const allTopics = new Set([
      ...Object.keys(this.config.topics ?? {}),
      ...consumerTopics,
    ]);

    if (allTopics.size > 0) {
      const admin = kafka.admin();
      await admin.connect();
      await admin.createTopics({
        topics: [...allTopics].map((topic) => ({ topic })),
      });
      await admin.disconnect();
    }

    this.producer = kafka.producer();
    await this.producer.connect();
    container.register({
      kafka: asValue(kafka),
      kafkaProducer: asValue(this.producer),
    });

    if (consumerTopics.length > 0) {
      this.consumer = kafka.consumer({ groupId });
      await this.consumer.connect();
      await this.consumer.subscribe({ topics: consumerTopics });
      await this.consumer.run({
        eachMessage: async ({ topic, message }) => {
          const handler = dispatch[topic];
          if (handler && message.value) await handler(message.value);
        },
      });
    }
  }

  async stop(): Promise<void> {
    await this.consumer?.disconnect();
    await this.producer?.disconnect();
  }
}
