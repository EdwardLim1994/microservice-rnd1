import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";
import CreateEmployeeUseCase from "../../src/usecases/CreateEmployeeUseCase";
import type { RegisterEmployeeContext } from "../../src/usecases/RegisterEmployeeSaga";

interface MockRepository {
	employeeRepository: EmployeeRepository;
	created: () => unknown[];
}

function createMockRepository(options: {
	findById?: (id: string) => Promise<unknown>;
	findByEmail?: (email: string) => Promise<unknown>;
} = {}): MockRepository {
	const created: unknown[] = [];
	const repo = {
		findById: options.findById ?? (async () => null),
		findByEmail: options.findByEmail ?? (async () => null),
		create: async (data: Record<string, unknown>) => {
			const employee = { id: "emp-1", ...data };
			created.push(employee);
			return employee;
		},
	};
	return { employeeRepository: repo as unknown as EmployeeRepository, created: () => created };
}

function validContext(overrides: Partial<RegisterEmployeeContext> = {}): RegisterEmployeeContext {
	return {
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
		...overrides,
	};
}

function getGraphQLError(thrown: unknown): GraphQLError {
	expect(thrown).toBeInstanceOf(GraphQLError);
	return thrown as GraphQLError;
}

test("creates an Employee record and returns its id", async () => {
	const { employeeRepository, created } = createMockRepository();
	const useCase = new CreateEmployeeUseCase({ employeeRepository });

	const result = await useCase.execute(validContext());

	expect(result.employeeId).toBe("emp-1");
	expect(result.employee).toMatchObject({ id: "emp-1", email: "jane.doe@example.com" });
	expect(created()).toHaveLength(1);
});

test("throws CONFLICT when the email is already registered", async () => {
	const { employeeRepository } = createMockRepository({
		findByEmail: async () => ({ id: "existing" }),
	});
	const useCase = new CreateEmployeeUseCase({ employeeRepository });

	let thrown: unknown;
	try {
		await useCase.execute(validContext());
	} catch (error) {
		thrown = error;
	}

	expect(getGraphQLError(thrown).extensions?.code).toBe("CONFLICT");
});

test("throws BAD_USER_INPUT when a required field is missing", async () => {
	const { employeeRepository } = createMockRepository();
	const useCase = new CreateEmployeeUseCase({ employeeRepository });

	let thrown: unknown;
	try {
		await useCase.execute(validContext({ email: "" }));
	} catch (error) {
		thrown = error;
	}

	expect(getGraphQLError(thrown).extensions?.code).toBe("BAD_USER_INPUT");
});

test("throws NOT_FOUND when supervisorId does not exist", async () => {
	const { employeeRepository } = createMockRepository({ findById: async () => null });
	const useCase = new CreateEmployeeUseCase({ employeeRepository });

	let thrown: unknown;
	try {
		await useCase.execute(validContext({ supervisorId: "missing-id" }));
	} catch (error) {
		thrown = error;
	}

	expect(getGraphQLError(thrown).extensions?.code).toBe("NOT_FOUND");
});

test("accepts a supervisorId that exists", async () => {
	const { employeeRepository, created } = createMockRepository({
		findById: async (id) => ({ id }),
	});
	const useCase = new CreateEmployeeUseCase({ employeeRepository });

	await useCase.execute(validContext({ supervisorId: "sup-1" }));

	expect(created()[0]).toMatchObject({ supervisorId: "sup-1" });
});
