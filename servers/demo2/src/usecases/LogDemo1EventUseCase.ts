import { BaseUseCase } from "lib";

interface Demo1Event {
	id: string;
	name: string;
}

export default class LogDemo1EventUseCase extends BaseUseCase<
	Demo1Event,
	void
> {
	async execute(input: Demo1Event): Promise<void> {
		console.log(`[demo1.events] received Demo1: ${input.id} (${input.name})`);
	}
}
