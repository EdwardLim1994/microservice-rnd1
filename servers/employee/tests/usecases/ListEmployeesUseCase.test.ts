import { expect, test } from "@rstest/core";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";
import ListEmployeesUseCase from "../../src/usecases/ListEmployeesUseCase";

test("returns every employee from the repository", async () => {
	const employees = [
		{ id: "emp-1", firstName: "Jane", lastName: "Doe" },
		{ id: "emp-2", firstName: "John", lastName: "Smith" },
	];
	const employeeRepository = {
		findAll: async () => employees,
	} as unknown as EmployeeRepository;
	const useCase = new ListEmployeesUseCase({ employeeRepository });

	const result = await useCase.execute();

	expect(result).toBe(employees);
});

test("returns an empty array without error when there are no employees", async () => {
	const employeeRepository = {
		findAll: async () => [],
	} as unknown as EmployeeRepository;
	const useCase = new ListEmployeesUseCase({ employeeRepository });

	const result = await useCase.execute();

	expect(result).toEqual([]);
});
