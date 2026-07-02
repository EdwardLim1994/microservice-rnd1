import { BaseUseCase } from "server";

export default class LogHeartbeatUseCase extends BaseUseCase<void, void> {
	async execute(): Promise<void> {
		console.log(`[demo1] heartbeat at ${new Date().toISOString()}`);
	}
}
