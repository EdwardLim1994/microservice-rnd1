import {
	Demo1Demo1eventProto,
	Demo1Demo1Proto,
	type Demo1GoogleProtobuf,
} from "api";
import type { RedisClient } from "bun";
import { BaseUseCase, type KafkaProducer } from "lib";
import type { DemoRepository } from "../repositories";

export default class TestDemoUseCase extends BaseUseCase<
	Demo1GoogleProtobuf.Empty,
	Demo1Demo1Proto.Demo1
> {
	private readonly kafkaProducer: KafkaProducer;
	private readonly demoRepository: DemoRepository;
	private readonly redis: RedisClient;

	constructor({
		kafkaProducer,
		demoRepository,
		redis,
	}: {
		kafkaProducer: KafkaProducer;
		demoRepository: DemoRepository;
		redis: RedisClient;
	}) {
		super();
		this.kafkaProducer = kafkaProducer;
		this.demoRepository = demoRepository;
		this.redis = redis;
	}

	async execute(
		_input: Demo1GoogleProtobuf.Empty,
	): Promise<Demo1Demo1Proto.Demo1> {
		const demo1 = Demo1Demo1Proto.Demo1.create({
			id: "hello world",
			name: "Hello World Tester",
		});

		const result = await this.demoRepository.create(demo1.name);

		await this.redis.set(
			`demo1:${result.id}`,
			JSON.stringify({ id: result.id, name: result.name }),
		);

		const event = Demo1Demo1eventProto.Demo1Event.create({
			id: result.id,
			name: result.name,
		});
		await this.kafkaProducer.send("demo1.events", event);

		return demo1;
	}
}
