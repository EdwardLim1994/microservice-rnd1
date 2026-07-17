import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import AssignSupervisorUseCase from "../../src/usecases/AssignSupervisorUseCase";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";

function createMockRepo(employees: Record<string, unknown>) {
	const updated: { id: string; supervisorId: string }[] = [];
	const repo = {
		async findById(id: string) {
			return employees[id] ?? null;
		},
		async updateSupervisor(id: string, supervisorId: string) {
			updated.push({ id, supervisorId });
			return { id, supervisorId, supervisor: employees[supervisorId] };
		},
	};
	return { repo: repo as unknown as EmployeeRepository, updated: () => updated };
}

function getGraphQLError(thrown: unknown): GraphQLError {
	expect(thrown).toBeInstanceOf(GraphQLError);
	return thrown as GraphQLError;
}

// [INT-2-1] Valid supervisor assignment
test("valid assignment updates the employee record", async () => {
	const { repo, updated } = createMockRepo({ "emp-1": { id: "emp-1" }, "sup-1": { id: "sup-1" } });
	const useCase = new AssignSupervisorUseCase({ employeeRepository: repo });

	const result = await useCase.execute({ employeeId: "emp-1", supervisorId: "sup-1" });

	expect(updated()).toEqual([{ id: "emp-1", supervisorId: "sup-1" }]);
	expect((result as { supervisorId: string }).supervisorId).toBe("sup-1");
});

// [INT-2-2] Non-existent supervisorId
test("non-existent supervisorId throws a not-found GraphQLError", async () => {
	const { repo } = createMockRepo({ "emp-1": { id: "emp-1" } });
	const useCase = new AssignSupervisorUseCase({ employeeRepository: repo });

	let thrown: unknown;
	try {
		await useCase.execute({ employeeId: "emp-1", supervisorId: "missing" });
	} catch (error) {
		thrown = error;
	}

	const error = getGraphQLError(thrown);
	expect(String(error.extensions?.code)).toBe("NOT_FOUND");
});

// [INT-2-2 variant] Non-existent employeeId
test("non-existent employeeId throws a not-found GraphQLError", async () => {
	const { repo } = createMockRepo({ "sup-1": { id: "sup-1" } });
	const useCase = new AssignSupervisorUseCase({ employeeRepository: repo });

	let thrown: unknown;
	try {
		await useCase.execute({ employeeId: "missing", supervisorId: "sup-1" });
	} catch (error) {
		thrown = error;
	}

	const error = getGraphQLError(thrown);
	expect(String(error.extensions?.code)).toBe("NOT_FOUND");
});

// [INT-2-3] Self-supervision
test("assigning an employee as their own supervisor throws a validation GraphQLError", async () => {
	const { repo } = createMockRepo({ "emp-1": { id: "emp-1" } });
	const useCase = new AssignSupervisorUseCase({ employeeRepository: repo });

	let thrown: unknown;
	try {
		await useCase.execute({ employeeId: "emp-1", supervisorId: "emp-1" });
	} catch (error) {
		thrown = error;
	}

	const error = getGraphQLError(thrown);
	expect(String(error.extensions?.code)).toBe("VALIDATION_ERROR");
});
