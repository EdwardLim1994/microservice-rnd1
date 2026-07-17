import { expect, test } from "@rstest/core";
import RegisterEmployeeGrpcUseCase from "../../src/usecases/RegisterEmployeeGrpcUseCase";
import type RegisterEmployeeUseCase from "../../src/usecases/RegisterEmployeeUseCase";

function createMockRegisterEmployeeUseCase(
	result: unknown,
): { useCase: RegisterEmployeeUseCase; lastCall: () => unknown } {
	let lastCall: unknown;
	const useCase = {
		async execute(input: unknown) {
			lastCall = input;
			return result;
		},
	};
	return { useCase: useCase as unknown as RegisterEmployeeUseCase, lastCall: () => lastCall };
}

test("maps the gRPC request into the domain use case's { input } shape", async () => {
	const { useCase, lastCall } = createMockRegisterEmployeeUseCase({
		employee: {
			id: "emp-1",
			employeeId: "EMP-001",
			fullName: "Ada Lovelace",
			role: "Engineer",
			department: "Engineering",
			grossSalary: 5000,
			supervisor: null,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		},
		temporaryPassword: "Tmp-abc123!",
	});
	const grpcUseCase = new RegisterEmployeeGrpcUseCase({ registerEmployeeUseCase: useCase });

	await grpcUseCase.execute({
		$type: "employee.RegisterEmployeeRequest",
		fullName: "Ada Lovelace",
		employeeId: "EMP-001",
		role: "Engineer",
		department: "Engineering",
		grossSalary: 5000,
		supervisorId: "",
	});

	expect(lastCall()).toEqual({
		input: {
			fullName: "Ada Lovelace",
			employeeId: "EMP-001",
			role: "Engineer",
			department: "Engineering",
			grossSalary: 5000,
			supervisorId: null,
		},
	});
});

test("flattens supervisor to supervisorId and formats createdAt as ISO", async () => {
	const { useCase } = createMockRegisterEmployeeUseCase({
		employee: {
			id: "emp-1",
			employeeId: "EMP-001",
			fullName: "Ada Lovelace",
			role: "Engineer",
			department: "Engineering",
			grossSalary: 5000,
			supervisor: { id: "sup-1" },
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		},
		temporaryPassword: "Tmp-abc123!",
	});
	const grpcUseCase = new RegisterEmployeeGrpcUseCase({ registerEmployeeUseCase: useCase });

	const response = await grpcUseCase.execute({
		$type: "employee.RegisterEmployeeRequest",
		fullName: "Ada Lovelace",
		employeeId: "EMP-001",
		role: "Engineer",
		department: "Engineering",
		grossSalary: 5000,
		supervisorId: "sup-1",
	});

	expect(response.employee?.supervisorId).toBe("sup-1");
	expect(response.employee?.createdAt).toBe("2026-01-01T00:00:00.000Z");
	expect(response.temporaryPassword).toBe("Tmp-abc123!");
});
