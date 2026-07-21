import { expect, test } from "@rstest/core";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";
import DeleteEmployeeUseCase from "../../src/usecases/DeleteEmployeeUseCase";

test("deletes the employee when employeeId is present in context", async () => {
	const deleted: string[] = [];
	const employeeRepository = {
		delete: async (id: string) => {
			deleted.push(id);
		},
	} as unknown as EmployeeRepository;
	const useCase = new DeleteEmployeeUseCase({ employeeRepository });

	await useCase.execute({
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
		employeeId: "emp-1",
	});

	expect(deleted).toEqual(["emp-1"]);
});

test("is a no-op when employeeId is absent (CreateEmployeeUseCase itself never ran)", async () => {
	const deleted: string[] = [];
	const employeeRepository = {
		delete: async (id: string) => {
			deleted.push(id);
		},
	} as unknown as EmployeeRepository;
	const useCase = new DeleteEmployeeUseCase({ employeeRepository });

	await useCase.execute({
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
	});

	expect(deleted).toEqual([]);
});
