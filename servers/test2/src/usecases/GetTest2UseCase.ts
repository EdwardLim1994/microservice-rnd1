import { type Test2GoogleProtobuf, Test2Test2Proto } from "api";
import { BaseUseCase } from "server";

export default class GetTest2UseCase extends BaseUseCase<
	Test2GoogleProtobuf.Empty,
	Test2Test2Proto.Test2
> {
	async execute(): Promise<Test2Test2Proto.Test2> {
		return Test2Test2Proto.Test2.create({
			id: "test2",
		});
	}
}
