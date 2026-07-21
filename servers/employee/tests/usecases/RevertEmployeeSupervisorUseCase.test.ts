import { expect, test } from "@rstest/core";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";
import RevertEmployeeSupervisorUseCase from "../../src/usecases/RevertEmployeeSupervisorUseCase";

test("reverts the employee's supervisorId back to its previous value", async () => {
	const calls: Array<{ id: string; supervisorId: string | null }> = [];
	const employeeRepository = {
		updateSupervisor: async (id: string, supervisorId: string | null) => {
			calls.push({ id, supervisorId });
		},
	} as unknown as EmployeeRepository;
	const useCase = new RevertEmployeeSupervisorUseCase({ employeeRepository });

	await useCase.execute({
		employeeId: "emp-1",
		supervisorId: "sup-1",
		previousSupervisorId: "old-sup",
	});

	expect(calls).toEqual([{ id: "emp-1", supervisorId: "old-sup" }]);
});

test("reverts to null when there was no previous supervisor", async () => {
	const calls: Array<{ id: string; supervisorId: string | null }> = [];
	const employeeRepository = {
		updateSupervisor: async (id: string, supervisorId: string | null) => {
			calls.push({ id, supervisorId });
		},
	} as unknown as EmployeeRepository;
	const useCase = new RevertEmployeeSupervisorUseCase({ employeeRepository });

	await useCase.execute({
		employeeId: "emp-1",
		supervisorId: "sup-1",
		previousSupervisorId: null,
	});

	expect(calls).toEqual([{ id: "emp-1", supervisorId: null }]);
});

test("is a no-op when employeeId is absent (AssignSupervisorUseCase itself never ran)", async () => {
	const calls: unknown[] = [];
	const employeeRepository = {
		updateSupervisor: async (...args: unknown[]) => {
			calls.push(args);
		},
	} as unknown as EmployeeRepository;
	const useCase = new RevertEmployeeSupervisorUseCase({ employeeRepository });

	await useCase.execute({ supervisorId: "sup-1" });

	expect(calls).toEqual([]);
});
