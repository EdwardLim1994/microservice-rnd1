import { expect, test } from "@rstest/core";
import type AssignSupervisorSaga from "../../src/usecases/AssignSupervisorSaga";
import type { AssignSupervisorContext } from "../../src/usecases/AssignSupervisorSaga";
import AssignSupervisorGrpcUseCase from "../../src/usecases/AssignSupervisorGrpcUseCase";

const request = {
	$type: "employee.AssignSupervisorRequest" as const,
	employeeId: "emp-1",
	supervisorId: "sup-1",
};

function makeMockSaga(result: AssignSupervisorContext): AssignSupervisorSaga {
	return { execute: async () => result } as unknown as AssignSupervisorSaga;
}

test("maps the saga's result into the AssignSupervisorResponse proto shape", async () => {
	const createdAt = new Date("2026-01-01T00:00:00.000Z");
	const updatedAt = new Date("2026-01-02T00:00:00.000Z");
	const assignSupervisorSaga = makeMockSaga({
		employeeId: "emp-1",
		supervisorId: "sup-1",
		previousSupervisorId: null,
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
	});
	const useCase = new AssignSupervisorGrpcUseCase({ assignSupervisorSaga });

	const response = await useCase.execute(request);

	expect(response).toEqual({
		$type: "employee.AssignSupervisorResponse",
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
	});
});

test("throws when the saga completes without producing an employee record", async () => {
	const assignSupervisorSaga = makeMockSaga({
		employeeId: "emp-1",
		supervisorId: "sup-1",
	});
	const useCase = new AssignSupervisorGrpcUseCase({ assignSupervisorSaga });

	await expect(useCase.execute(request)).rejects.toThrow(
		"AssignSupervisorSaga completed without producing an employee record",
	);
});
