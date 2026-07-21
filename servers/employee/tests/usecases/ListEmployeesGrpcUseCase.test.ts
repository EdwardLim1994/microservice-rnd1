import { expect, test } from "@rstest/core";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";
import ListEmployeesGrpcUseCase from "../../src/usecases/ListEmployeesGrpcUseCase";

const now = new Date("2026-01-01T00:00:00.000Z");

test("encodes every repository employee into the protobuf response shape", async () => {
	const employeeRepository = {
		findAll: async () => [
			{
				id: "emp-1",
				firstName: "Jane",
				lastName: "Doe",
				gender: "FEMALE",
				email: "jane.doe@example.com",
				grossSalary: 5000,
				salaryPerDay: 200,
				supervisorId: null,
				createdAt: now,
				updatedAt: now,
			},
		],
	} as unknown as EmployeeRepository;
	const useCase = new ListEmployeesGrpcUseCase({ employeeRepository });

	const result = await useCase.execute({ $type: "employee.ListEmployeesRequest" });

	expect(result).toEqual({
		$type: "employee.ListEmployeesResponse",
		employees: [
			{
				$type: "employee.Employee",
				id: "emp-1",
				firstName: "Jane",
				lastName: "Doe",
				gender: "FEMALE",
				email: "jane.doe@example.com",
				grossSalary: 5000,
				salaryPerDay: 200,
				supervisorId: undefined,
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
			},
		],
	});
});

test("returns an empty employees array without error when there are no employees", async () => {
	const employeeRepository = {
		findAll: async () => [],
	} as unknown as EmployeeRepository;
	const useCase = new ListEmployeesGrpcUseCase({ employeeRepository });

	const result = await useCase.execute({ $type: "employee.ListEmployeesRequest" });

	expect(result).toEqual({ $type: "employee.ListEmployeesResponse", employees: [] });
});
