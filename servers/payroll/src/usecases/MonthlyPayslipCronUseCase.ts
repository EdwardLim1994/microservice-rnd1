import { BaseUseCase } from "server";
import GeneratePayslipsUseCase from "./GeneratePayslipsUseCase";

/**
 * Cron entrypoint for FEAT-3 — derives month/year from "now" (see requirements.yaml's
 * GeneratePayslipsInput spec: "derived from cron schedule") and delegates to
 * GeneratePayslipsUseCase, the same use case the GraphQL mutation exposes for manual/test
 * triggering.
 */
export default class MonthlyPayslipCronUseCase extends BaseUseCase<void, void> {
	private readonly generatePayslipsUseCase: GeneratePayslipsUseCase;

	constructor({ generatePayslipsUseCase }: { generatePayslipsUseCase: GeneratePayslipsUseCase }) {
		super();
		this.generatePayslipsUseCase = generatePayslipsUseCase;
	}

	async execute(): Promise<void> {
		const now = new Date();
		const result = await this.generatePayslipsUseCase.execute({
			month: now.getUTCMonth() + 1,
			year: now.getUTCFullYear(),
		});
		console.log(
			`MonthlyPayslipCronUseCase: generated ${(result as { generated: unknown[] }).generated.length}, failed ${(result as { failed: unknown[] }).failed.length}`,
		);
	}
}
