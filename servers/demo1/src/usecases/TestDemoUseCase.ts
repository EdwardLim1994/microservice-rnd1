import { create } from "@bufbuild/protobuf";
import {
	ProtobufSerializer,
	SchemaRegistryClient,
	SerdeType,
} from "@confluentinc/schemaregistry";
import {
	Demo1Demo1Proto,
	type Demo1GoogleProtobuf,
	Demo1ProtobufEs,
} from "api";
import type { Producer } from "kafkajs";
import { BaseUseCase } from "lib";
import type { DemoRepository } from "../repositories";

const schemaRegistry = SchemaRegistryClient.newClient({
	baseURLs: [process.env.SCHEMA_REGISTRY_URL ?? "http://localhost:8081"],
});

// autoRegisterSchemas: registers demo1.Demo1 under this subject on first use, and — the actual
// point — rejects a produce if the message shape is no longer BACKWARD-compatible with whatever
// schema is already registered for this topic, instead of failing silently on the consumer side.
const serializer = new ProtobufSerializer(schemaRegistry, SerdeType.VALUE, {
	autoRegisterSchemas: true,
});
serializer.registry.add(Demo1ProtobufEs.Demo1Schema);

export default class TestDemoUseCase extends BaseUseCase<
	Demo1GoogleProtobuf.Empty,
	Demo1Demo1Proto.Demo1
> {
	private readonly kafkaProducer: Producer;
	private readonly demoRepository: DemoRepository;

	constructor({
		kafkaProducer,
		demoRepository,
	}: { kafkaProducer: Producer; demoRepository: DemoRepository }) {
		super();
		this.kafkaProducer = kafkaProducer;
		this.demoRepository = demoRepository;
	}

	async execute(
		_input: Demo1GoogleProtobuf.Empty,
	): Promise<Demo1Demo1Proto.Demo1> {
		const demo1 = Demo1Demo1Proto.Demo1.create({
			id: "hello world",
			name: "Hello World Tester",
		});

		const result = await this.demoRepository.create(demo1.name);

		const registryMessage = create(Demo1ProtobufEs.Demo1Schema, {
			id: result.id,
			name: result.name,
		});

		const value = await serializer.serialize("demo1.events", registryMessage);

		await this.kafkaProducer.send({
			topic: "demo1.events",
			messages: [{ value }],
		});

		return demo1;
	}
}
