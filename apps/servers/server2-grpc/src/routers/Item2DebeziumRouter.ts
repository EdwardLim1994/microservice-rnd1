import { KafkaConsumerRouter, type KafkaHandlerMap } from "server";
import { ITEM2_DEBEZIUM_TOPIC } from "../topics";
import IndexItem2FromDebeziumUseCase from "../usecases/IndexItem2FromDebeziumUseCase";

// Debezium's own JSON envelope, not a protobuf schema — decode() here is a real, working
// implementation (unlike a Schema Registry topic's fromBinary shim), even though
// KafkaConsumerRouter.topics never actually calls it; it exists only so TTopicTypes infers the
// right decoded shape for `handlers` below.
const topicTypes = {
	[ITEM2_DEBEZIUM_TOPIC]: {
		decode: (payload: Uint8Array) =>
			JSON.parse(Buffer.from(payload).toString("utf-8")),
	},
};
type TopicTypes = typeof topicTypes;

export default class Item2DebeziumRouter extends KafkaConsumerRouter<TopicTypes> {
	get topicTypes(): TopicTypes {
		return topicTypes;
	}

	get handlers(): KafkaHandlerMap<TopicTypes> {
		return { [ITEM2_DEBEZIUM_TOPIC]: IndexItem2FromDebeziumUseCase };
	}
}
