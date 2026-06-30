import { Demo1Demo1Proto, Demo1GoogleProtobuf } from "api";
import { BaseUseCase } from "lib";

export default class TestDemoUseCase extends BaseUseCase<
	Demo1GoogleProtobuf.Empty,
	Demo1Demo1Proto.Demo1
> {
	async execute(
		_input: Demo1GoogleProtobuf.Empty,
	): Promise<Demo1Demo1Proto.Demo1> {
		return Demo1Demo1Proto.Demo1.create({
			id: "hello world",
			name: "Hello World Tester",
		});
	}
}
