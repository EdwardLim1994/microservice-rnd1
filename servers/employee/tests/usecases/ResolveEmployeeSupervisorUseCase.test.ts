import { expect, test } from "@rstest/core";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";
import ResolveEmployeeSupervisorUseCase from "../../src/usecases/ResolveEmployeeSupervisorUseCase";

test("resolves the supervisor by supervisorId when present", async () => {
	const supervisor = { id: "emp-1", firstName: "Jane", lastName: "Doe" };
	const employeeRepository = {
		findById: async (id: string) => (id === "emp-1" ? supervisor : null),
	} as unknown as EmployeeRepository;
	const useCase = new ResolveEmployeeSupervisorUseCase({ employeeRepository });

	const result = await useCase.execute({ supervisorId: "emp-1" });

	expect(result).toBe(supervisor);
});

test("returns null without calling the repository when supervisorId is absent", async () => {
	const calls: string[] = [];
	const employeeRepository = {
		findById: async (id: string) => {
			calls.push(id);
			return null;
		},
	} as unknown as EmployeeRepository;
	const useCase = new ResolveEmployeeSupervisorUseCase({ employeeRepository });

	const result = await useCase.execute({ supervisorId: null });

	expect(result).toBeNull();
	expect(calls).toEqual([]);
});
