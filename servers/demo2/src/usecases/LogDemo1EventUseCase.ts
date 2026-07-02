import type { Demo1Demo1eventProto } from "api";
import { BaseUseCase } from "server";

export default class LogDemo1EventUseCase extends BaseUseCase<
	Demo1Demo1eventProto.Demo1Event,
	void
> {
	async execute(input: Demo1Demo1eventProto.Demo1Event): Promise<void> {
		console.log(`[demo1.events] received Demo1: ${input.id} (${input.name})`);
	}
}
