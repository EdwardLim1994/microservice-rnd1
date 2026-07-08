import type { Test1GoogleProtobuf } from "api";
import { Test1Test1Proto } from "api";
import { BaseUseCase, type KafkaProducer } from "server";
import type { Test1Repository } from "../repositories";

export default class GetTest1UseCase extends BaseUseCase<
	Test1GoogleProtobuf.Empty,
	Test1Test1Proto.Test1
> {
	private readonly test1Repository: Test1Repository;
	private readonly kafkaProducer: KafkaProducer;

	constructor({
		test1Repository,
		kafkaProducer,
	}: {
		test1Repository: Test1Repository;
		kafkaProducer: KafkaProducer;
	}) {
		super();
		this.test1Repository = test1Repository;
		this.kafkaProducer = kafkaProducer;
	}

	async execute(): Promise<Test1Test1Proto.Test1> {
		const result = await this.test1Repository.create();

		// name is a placeholder event label (Test1 has no "name" column) — swap it out once
		// there's a real reason to distinguish event variants for this topic.
		await this.kafkaProducer.send("test1.events", {
			id: result.id,
			name: "created",
		});

		return Test1Test1Proto.Test1.create(result);
	}
}
