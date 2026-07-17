import { expect, test } from "@rstest/core";
import AssignSupervisorGrpcUseCase from "../../src/usecases/AssignSupervisorGrpcUseCase";
import type AssignSupervisorUseCase from "../../src/usecases/AssignSupervisorUseCase";

function createMockAssignSupervisorUseCase(
	result: unknown,
): { useCase: AssignSupervisorUseCase; lastCall: () => unknown } {
	let lastCall: unknown;
	const useCase = {
		async execute(input: unknown) {
			lastCall = input;
			return result;
		},
	};
	return { useCase: useCase as unknown as AssignSupervisorUseCase, lastCall: () => lastCall };
}

test("maps the gRPC request into the domain use case's { input } shape and flattens the response", async () => {
	const { useCase, lastCall } = createMockAssignSupervisorUseCase({
		id: "emp-1",
		employeeId: "EMP-001",
		fullName: "Ada Lovelace",
		role: "Engineer",
		department: "Engineering",
		grossSalary: 5000,
		supervisor: { id: "sup-1" },
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
	});
	const grpcUseCase = new AssignSupervisorGrpcUseCase({ assignSupervisorUseCase: useCase });

	const response = await grpcUseCase.execute({
		$type: "employee.AssignSupervisorRequest",
		employeeId: "emp-1",
		supervisorId: "sup-1",
	});

	expect(lastCall()).toEqual({ input: { employeeId: "emp-1", supervisorId: "sup-1" } });
	expect(response.supervisorId).toBe("sup-1");
	expect(response.createdAt).toBe("2026-01-01T00:00:00.000Z");
});
