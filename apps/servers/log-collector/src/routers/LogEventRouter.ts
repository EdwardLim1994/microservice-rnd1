import {
	KafkaConsumerRouter,
	type KafkaHandlerMap,
	LOG_EVENTS_TOPIC,
} from "server";
import PublishLogEventToLokiUseCase from "../usecases/PublishLogEventToLokiUseCase";

// Real, working decode() (unlike a Schema Registry topic's fromBinary shim) — every server's
// LoggerPlugin publishes plain JSON (see LoggerPlugin.ts), not protobuf, so this server's
// KafkaDriver is configured with a JsonKafkaSerializer (see ../app.ts) rather than
// SchemaRegistryKafkaSerializer. KafkaConsumerRouter.topics always decodes through the
// container-registered kafkaSerializer regardless of what's declared here — this only exists so
// TTopicTypes infers the right decoded shape for `handlers` below (same convention as
// Item2DebeziumRouter in apps/servers/server2-grpc).
const topicTypes = {
	[LOG_EVENTS_TOPIC]: {
		decode: (payload: Uint8Array) =>
			JSON.parse(Buffer.from(payload).toString("utf-8")),
	},
};
type TopicTypes = typeof topicTypes;

export default class LogEventRouter extends KafkaConsumerRouter<TopicTypes> {
	get topicTypes(): TopicTypes {
		return topicTypes;
	}

	get handlers(): KafkaHandlerMap<TopicTypes> {
		return { [LOG_EVENTS_TOPIC]: PublishLogEventToLokiUseCase };
	}
}
