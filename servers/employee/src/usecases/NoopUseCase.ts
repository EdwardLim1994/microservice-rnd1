import { BaseUseCase } from "server";

// No later procedure to fail after RegisterEmployeeSaga's final step, but ProcedureOrchestrator's
// `.procedure()` still requires a fallback — reuse a no-op, same pattern packages/server/CLAUDE.md
// documents for ProcedureOrchestrator.
export default class NoopUseCase extends BaseUseCase<unknown, void> {
	async execute() {}
}
