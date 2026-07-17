import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import { AuthentikApiError, type AuthentikClient } from "server";
import RegisterEmployeeUseCase from "../../src/usecases/RegisterEmployeeUseCase";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";

interface MockRepo {
	repo: EmployeeRepository;
	created: () => Record<string, unknown>[];
	deleted: () => string[];
}

function createMockRepo(options: {
	findById?: (id: string) => Promise<unknown>;
	createThrows?: { code: string };
} = {}): MockRepo {
	const created: Record<string, unknown>[] = [];
	const deleted: string[] = [];
	let nextId = 1;

	const repo = {
		async findById(id: string) {
			if (options.findById) return options.findById(id);
			return null;
		},
		async create(data: Record<string, unknown>) {
			if (options.createThrows) {
				const error = new Error("duplicate") as Error & { code: string };
				error.code = options.createThrows.code;
				throw error;
			}
			const employee = { id: `emp-${nextId++}`, ...data, createdAt: new Date(), supervisor: null };
			created.push(employee);
			return employee;
		},
		async delete(id: string) {
			deleted.push(id);
		},
	};

	return {
		repo: repo as unknown as EmployeeRepository,
		created: () => created,
		deleted: () => deleted,
	};
}

function createMockAuthentik(
	createUserImpl: (input: unknown) => Promise<unknown> = async () => ({ pk: 1, username: "x", email: "x" }),
): AuthentikClient {
	return { createUser: createUserImpl } as unknown as AuthentikClient;
}

function validInput(overrides: Record<string, unknown> = {}) {
	return {
		fullName: "Ada Lovelace",
		employeeId: "EMP-001",
		role: "Engineer",
		department: "Engineering",
		grossSalary: 5000,
		...overrides,
	};
}

function getGraphQLError(thrown: unknown): GraphQLError {
	expect(thrown).toBeInstanceOf(GraphQLError);
	return thrown as GraphQLError;
}

// [E2E-1 / INT-1-1] Valid registration
test("valid registration creates the employee and returns a temporary password", async () => {
	const { repo } = createMockRepo();
	const authentik = createMockAuthentik();
	const useCase = new RegisterEmployeeUseCase({ employeeRepository: repo, authentik });

	const result = await useCase.execute(validInput());

	expect(result.employee.fullName).toBe("Ada Lovelace");
	expect(typeof result.temporaryPassword).toBe("string");
	expect(result.temporaryPassword.length).toBeGreaterThan(0);
});

// [INT-1-2] Duplicate employeeId
test("duplicate employeeId throws a conflict GraphQLError", async () => {
	const { repo } = createMockRepo({ createThrows: { code: "P2002" } });
	const authentik = createMockAuthentik();
	const useCase = new RegisterEmployeeUseCase({ employeeRepository: repo, authentik });

	let thrown: unknown;
	try {
		await useCase.execute(validInput());
	} catch (error) {
		thrown = error;
	}

	const error = getGraphQLError(thrown);
	expect(String(error.extensions?.code)).toBe("CONFLICT");
});

// [INT-1-3] Authentik failure rolls back the Postgres insert
test("authentik failure deletes the just-created employee record", async () => {
	const { repo, created, deleted } = createMockRepo();
	const authentik = createMockAuthentik(async () => {
		throw new AuthentikApiError(503, { detail: "unavailable" });
	});
	const useCase = new RegisterEmployeeUseCase({ employeeRepository: repo, authentik });

	let thrown: unknown;
	try {
		await useCase.execute(validInput());
	} catch (error) {
		thrown = error;
	}

	getGraphQLError(thrown);
	expect(created()).toHaveLength(1);
	expect(deleted()).toEqual([created()[0]?.id]);
});

// [INT-1-4] Invalid supervisorId
test("non-existent supervisorId throws a not-found GraphQLError", async () => {
	const { repo } = createMockRepo({ findById: async () => null });
	const authentik = createMockAuthentik();
	const useCase = new RegisterEmployeeUseCase({ employeeRepository: repo, authentik });

	let thrown: unknown;
	try {
		await useCase.execute(validInput({ supervisorId: "does-not-exist" }));
	} catch (error) {
		thrown = error;
	}

	const error = getGraphQLError(thrown);
	expect(String(error.extensions?.code)).toBe("NOT_FOUND");
});

// [INT-1-5] Negative grossSalary
test("negative grossSalary throws a validation GraphQLError", async () => {
	const { repo } = createMockRepo();
	const authentik = createMockAuthentik();
	const useCase = new RegisterEmployeeUseCase({ employeeRepository: repo, authentik });

	let thrown: unknown;
	try {
		await useCase.execute(validInput({ grossSalary: -100 }));
	} catch (error) {
		thrown = error;
	}

	const error = getGraphQLError(thrown);
	expect(String(error.extensions?.code)).toBe("VALIDATION_ERROR");
});

// Edge case: empty fullName
test("empty fullName throws a validation GraphQLError", async () => {
	const { repo } = createMockRepo();
	const authentik = createMockAuthentik();
	const useCase = new RegisterEmployeeUseCase({ employeeRepository: repo, authentik });

	let thrown: unknown;
	try {
		await useCase.execute(validInput({ fullName: "" }));
	} catch (error) {
		thrown = error;
	}

	getGraphQLError(thrown);
});
