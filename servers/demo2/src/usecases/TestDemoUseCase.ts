import { Demo1GoogleProtobuf, Demo2Demo2Proto } from "api";
import { BaseUseCase } from "lib";

export default class TestDemoUseCase extends BaseUseCase<
	Demo1GoogleProtobuf.Empty,
	Demo2Demo2Proto.Demo2
> {
	async execute(
		_input: Demo1GoogleProtobuf.Empty,
	): Promise<Demo2Demo2Proto.Demo2> {
		return Demo2Demo2Proto.Demo2.create({
			id: "hello world",
			name: "Hello World Tester",
		});
	}
}
