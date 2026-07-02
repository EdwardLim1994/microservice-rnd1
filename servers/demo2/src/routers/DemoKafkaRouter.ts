import { demo1EventsTopics } from "api";
import { KafkaConsumerRouter, type KafkaHandlerMap } from "server";
import { LogDemo1EventUseCase } from "../usecases";

// demo1EventsTopics (from `api`, same declaration demo1 uses for its config.topics) is the
// message contract for this topic — decode itself is fully automatic: KafkaConsumerRouter
// resolves the kafkaSerializer configured on KafkaDriver in this server's app.ts and decodes
// every topic through it, so this router only declares which topics it consumes.
export default class DemoKafkaRouter extends KafkaConsumerRouter<
	typeof demo1EventsTopics
> {
	get topicTypes() {
		return demo1EventsTopics;
	}

	get handlers(): KafkaHandlerMap<typeof demo1EventsTopics> {
		return { "demo1.events": LogDemo1EventUseCase };
	}
}
