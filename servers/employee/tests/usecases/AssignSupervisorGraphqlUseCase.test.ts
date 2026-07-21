import { expect, test } from "@rstest/core";
import type AssignSupervisorSaga from "../../src/usecases/AssignSupervisorSaga";
import type { AssignSupervisorContext } from "../../src/usecases/AssignSupervisorSaga";
import AssignSupervisorGraphqlUseCase from "../../src/usecases/AssignSupervisorGraphqlUseCase";

function makeMockSaga(result: AssignSupervisorContext): AssignSupervisorSaga {
	return { execute: async () => result } as unknown as AssignSupervisorSaga;
}

test("returns the saga's updated Employee record directly", async () => {
	const employee = {
		id: "emp-1",
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
		supervisorId: "sup-1",
		authentikUserId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	const assignSupervisorSaga = makeMockSaga({
		employeeId: "emp-1",
		supervisorId: "sup-1",
		employee,
	});
	const useCase = new AssignSupervisorGraphqlUseCase({ assignSupervisorSaga });

	const result = await useCase.execute({ employeeId: "emp-1", supervisorId: "sup-1" });

	expect(result).toBe(employee);
});

test("throws when the saga completes without producing an employee record", async () => {
	const assignSupervisorSaga = makeMockSaga({ employeeId: "emp-1", supervisorId: "sup-1" });
	const useCase = new AssignSupervisorGraphqlUseCase({ assignSupervisorSaga });

	await expect(
		useCase.execute({ employeeId: "emp-1", supervisorId: "sup-1" }),
	).rejects.toThrow("AssignSupervisorSaga completed without producing an employee record");
});
