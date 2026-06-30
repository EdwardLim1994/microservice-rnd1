import { Demo1Demo1Proto, type Demo1GoogleProtobuf } from "api";
import { BaseUseCase } from "lib";
import type { DemoRepository } from "../repositories/";

export default class TestDemoUseCase extends BaseUseCase<
	Demo1GoogleProtobuf.Empty,
	Demo1Demo1Proto.Demo1
> {
	private readonly _demoRepository: DemoRepository;

	constructor({ demoRepository }: { demoRepository: DemoRepository }) {
		super();
		this._demoRepository = demoRepository;
	}

	async execute(
		_input: Demo1GoogleProtobuf.Empty,
	): Promise<Demo1Demo1Proto.Demo1> {
		const result = await this._demoRepository.create("this is a test");
		return Demo1Demo1Proto.Demo1.create(result);
	}
}
