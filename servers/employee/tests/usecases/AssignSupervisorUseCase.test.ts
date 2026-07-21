import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";
import AssignSupervisorUseCase from "../../src/usecases/AssignSupervisorUseCase";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const SIX_YEARS_AGO = new Date("2020-01-01T00:00:00.000Z");
const ONE_YEAR_AGO = new Date("2025-01-01T00:00:00.000Z");

function makeRepository(records: Record<string, { id: string; supervisorId: string | null; createdAt: Date }>) {
	const updateCalls: Array<{ id: string; supervisorId: string | null }> = [];
	const employeeRepository = {
		findById: async (id: string) => records[id] ?? null,
		updateSupervisor: async (id: string, supervisorId: string | null) => {
			updateCalls.push({ id, supervisorId });
			return { ...records[id], supervisorId };
		},
	} as unknown as EmployeeRepository;
	return { employeeRepository, updateCalls: () => updateCalls };
}

function getGraphQLError(thrown: unknown): GraphQLError {
	expect(thrown).toBeInstanceOf(GraphQLError);
	return thrown as GraphQLError;
}

test("assigns the supervisor when the target has served at least 5 years", async () => {
	const { employeeRepository, updateCalls } = makeRepository({
		"emp-1": { id: "emp-1", supervisorId: null, createdAt: NOW },
		"sup-1": { id: "sup-1", supervisorId: null, createdAt: SIX_YEARS_AGO },
	});
	const useCase = new AssignSupervisorUseCase({ employeeRepository }, () => NOW);

	const result = await useCase.execute({ employeeId: "emp-1", supervisorId: "sup-1" });

	expect(updateCalls()).toEqual([{ id: "emp-1", supervisorId: "sup-1" }]);
	expect(result.previousSupervisorId).toBeNull();
	expect(result.employee).toMatchObject({ id: "emp-1", supervisorId: "sup-1" });
});

test("returns the prior supervisorId for compensation", async () => {
	const { employeeRepository } = makeRepository({
		"emp-1": { id: "emp-1", supervisorId: "old-sup", createdAt: NOW },
		"sup-1": { id: "sup-1", supervisorId: null, createdAt: SIX_YEARS_AGO },
	});
	const useCase = new AssignSupervisorUseCase({ employeeRepository }, () => NOW);

	const result = await useCase.execute({ employeeId: "emp-1", supervisorId: "sup-1" });

	expect(result.previousSupervisorId).toBe("old-sup");
});

test("throws BAD_USER_INPUT when employeeId and supervisorId are the same, without touching the repository", async () => {
	const { employeeRepository, updateCalls } = makeRepository({
		"emp-1": { id: "emp-1", supervisorId: null, createdAt: SIX_YEARS_AGO },
	});
	const useCase = new AssignSupervisorUseCase({ employeeRepository }, () => NOW);

	let thrown: unknown;
	try {
		await useCase.execute({ employeeId: "emp-1", supervisorId: "emp-1" });
	} catch (error) {
		thrown = error;
	}

	expect(getGraphQLError(thrown).extensions?.code).toBe("BAD_USER_INPUT");
	expect(updateCalls()).toEqual([]);
});

test("throws NOT_FOUND when employeeId does not exist", async () => {
	const { employeeRepository } = makeRepository({
		"sup-1": { id: "sup-1", supervisorId: null, createdAt: SIX_YEARS_AGO },
	});
	const useCase = new AssignSupervisorUseCase({ employeeRepository }, () => NOW);

	let thrown: unknown;
	try {
		await useCase.execute({ employeeId: "missing", supervisorId: "sup-1" });
	} catch (error) {
		thrown = error;
	}

	expect(getGraphQLError(thrown).extensions?.code).toBe("NOT_FOUND");
});

test("throws NOT_FOUND when supervisorId does not exist", async () => {
	const { employeeRepository } = makeRepository({
		"emp-1": { id: "emp-1", supervisorId: null, createdAt: NOW },
	});
	const useCase = new AssignSupervisorUseCase({ employeeRepository }, () => NOW);

	let thrown: unknown;
	try {
		await useCase.execute({ employeeId: "emp-1", supervisorId: "missing" });
	} catch (error) {
		thrown = error;
	}

	expect(getGraphQLError(thrown).extensions?.code).toBe("NOT_FOUND");
});

test("throws INELIGIBLE when the target has served fewer than 5 years", async () => {
	const { employeeRepository, updateCalls } = makeRepository({
		"emp-1": { id: "emp-1", supervisorId: null, createdAt: NOW },
		"sup-1": { id: "sup-1", supervisorId: null, createdAt: ONE_YEAR_AGO },
	});
	const useCase = new AssignSupervisorUseCase({ employeeRepository }, () => NOW);

	let thrown: unknown;
	try {
		await useCase.execute({ employeeId: "emp-1", supervisorId: "sup-1" });
	} catch (error) {
		thrown = error;
	}

	expect(getGraphQLError(thrown).extensions?.code).toBe("INELIGIBLE");
	expect(updateCalls()).toEqual([]);
});
