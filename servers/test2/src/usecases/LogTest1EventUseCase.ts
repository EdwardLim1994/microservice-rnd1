import type { Test1Test1eventProto } from "api";
import { BaseUseCase } from "server";

export default class LogTest1EventUseCase extends BaseUseCase<
	Test1Test1eventProto.Test1Event,
	void
> {
	async execute(input: Test1Test1eventProto.Test1Event): Promise<void> {
		console.log(`[test1.events] received Test1: ${input.id} (${input.name})`);
	}
}
