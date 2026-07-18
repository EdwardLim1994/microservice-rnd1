import { BaseUseCase } from "server";

export default class HealthUseCase extends BaseUseCase<void, boolean> {
	async execute(): Promise<boolean> {
		return true;
	}
}
