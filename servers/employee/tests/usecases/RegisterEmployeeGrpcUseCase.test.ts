import { expect, test } from "@rstest/core";
import type RegisterEmployeeSaga from "../../src/usecases/RegisterEmployeeSaga";
import type { RegisterEmployeeContext } from "../../src/usecases/RegisterEmployeeSaga";
import RegisterEmployeeGrpcUseCase from "../../src/usecases/RegisterEmployeeGrpcUseCase";

const request = {
	$type: "employee.RegisterEmployeeRequest" as const,
	firstName: "Jane",
	lastName: "Doe",
	gender: "FEMALE",
	email: "jane.doe@example.com",
	grossSalary: 5000,
	salaryPerDay: 200,
	supervisorId: "sup-1",
};

function makeMockSaga(result: RegisterEmployeeContext): RegisterEmployeeSaga {
	return { execute: async () => result } as unknown as RegisterEmployeeSaga;
}

test("maps the saga's result into the RegisterEmployeeResponse proto shape", async () => {
	const createdAt = new Date("2026-01-01T00:00:00.000Z");
	const updatedAt = new Date("2026-01-02T00:00:00.000Z");
	const registerEmployeeSaga = makeMockSaga({
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
		employeeId: "emp-1",
		employee: {
			id: "emp-1",
			firstName: "Jane",
			lastName: "Doe",
			gender: "FEMALE",
			email: "jane.doe@example.com",
			grossSalary: 5000,
			salaryPerDay: 200,
			supervisorId: "sup-1",
			authentikUserId: null,
			createdAt,
			updatedAt,
		},
		temporaryPassword: "temp-pass-123",
	});
	const useCase = new RegisterEmployeeGrpcUseCase({ registerEmployeeSaga });

	const response = await useCase.execute(request);

	expect(response).toEqual({
		$type: "employee.RegisterEmployeeResponse",
		employee: {
			$type: "employee.Employee",
			id: "emp-1",
			firstName: "Jane",
			lastName: "Doe",
			gender: "FEMALE",
			email: "jane.doe@example.com",
			grossSalary: 5000,
			salaryPerDay: 200,
			supervisorId: "sup-1",
			createdAt: createdAt.toISOString(),
			updatedAt: updatedAt.toISOString(),
		},
		temporaryPassword: "temp-pass-123",
	});
});

test("omits supervisorId in the response when the employee has none", async () => {
	const createdAt = new Date();
	const updatedAt = new Date();
	const registerEmployeeSaga = makeMockSaga({
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
		employee: {
			id: "emp-1",
			firstName: "Jane",
			lastName: "Doe",
			gender: "FEMALE",
			email: "jane.doe@example.com",
			grossSalary: 5000,
			salaryPerDay: 200,
			supervisorId: null,
			authentikUserId: null,
			createdAt,
			updatedAt,
		},
		temporaryPassword: "temp-pass-123",
	});
	const useCase = new RegisterEmployeeGrpcUseCase({ registerEmployeeSaga });

	const response = await useCase.execute(request);

	expect(response.employee?.supervisorId).toBeUndefined();
});

test("throws when the saga completes without producing an employee record", async () => {
	const registerEmployeeSaga = makeMockSaga({
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
	});
	const useCase = new RegisterEmployeeGrpcUseCase({ registerEmployeeSaga });

	await expect(useCase.execute(request)).rejects.toThrow(
		"RegisterEmployeeSaga completed without producing an employee record",
	);
});
