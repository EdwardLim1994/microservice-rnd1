import type { KafkaHandlerMap } from 'server';
import { KafkaConsumerRouter } from 'server';
import { ConsumeNotificationEventUseCase } from '../usecases/ConsumeNotificationEventUseCase';

// ponytail: placeholder decode — KafkaConsumerRouter.topics overrides with the container's JsonKafkaSerializer
const jsonPlaceholder = {
  decode: (b: Uint8Array) => JSON.parse(Buffer.from(b).toString()),
};

const topicTypes = {
  'notification-events': jsonPlaceholder,
} as const;

type TopicTypes = typeof topicTypes;

export class NotificationKafkaRouter extends KafkaConsumerRouter<TopicTypes> {
  get topicTypes(): TopicTypes {
    return topicTypes;
  }

  get handlers(): KafkaHandlerMap<TopicTypes> {
    return {
      'notification-events': ConsumeNotificationEventUseCase,
    };
  }
}
