import { test1EventsTopics } from "api";
import { KafkaConsumerRouter, type KafkaHandlerMap } from "server";
import { LogTest1EventUseCase } from "../usecases";

// test1EventsTopics (from `api`, same declaration test1 uses for its config.topics) is the
// message contract for this topic — decode itself is fully automatic: KafkaConsumerRouter
// resolves the kafkaSerializer configured on KafkaDriver in this server's app.ts and decodes
// every topic through it, so this router only declares which topics it consumes.
export default class Test2KafkaRouter extends KafkaConsumerRouter<
	typeof test1EventsTopics
> {
	get topicTypes() {
		return test1EventsTopics;
	}

	get handlers(): KafkaHandlerMap<typeof test1EventsTopics> {
		return { "test1.events": LogTest1EventUseCase };
	}
}
