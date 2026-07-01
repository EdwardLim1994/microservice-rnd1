import {
	ProtobufDeserializer,
	SchemaRegistryClient,
	SerdeType,
} from "@confluentinc/schemaregistry";
import { KafkaConsumerRouter, type KafkaHandlerMap } from "lib";
import { LogDemo1EventUseCase } from "../usecases";

const schemaRegistry = SchemaRegistryClient.newClient({
	baseURLs: [process.env.SCHEMA_REGISTRY_URL ?? "http://localhost:8081"],
});

// No local .proto/codegen needed on the consumer side — the deserializer fetches whatever
// schema the producer actually registered (by the ID embedded in the message), so this stays
// correct even if demo1's schema evolves, as long as it's still BACKWARD-compatible.
const deserializer = new ProtobufDeserializer(
	schemaRegistry,
	SerdeType.VALUE,
	{},
);

const demo1EventsTopic = {
	"demo1.events": {
		decode: (payload: Uint8Array) =>
			deserializer.deserialize(
				"demo1.events",
				Buffer.from(payload),
			) as Promise<{ id: string; name: string }>,
	},
};

export default class DemoKafkaRouter extends KafkaConsumerRouter<
	typeof demo1EventsTopic
> {
	get topics() {
		return demo1EventsTopic;
	}

	get handlers(): KafkaHandlerMap<typeof demo1EventsTopic> {
		return { "demo1.events": LogDemo1EventUseCase };
	}
}
