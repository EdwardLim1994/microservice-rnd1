import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import { AuthentikApiError, type AuthentikClient } from "server";
import CreateAuthentikAccountUseCase from "../../src/usecases/CreateAuthentikAccountUseCase";

interface MockAuthentik {
	authentik: AuthentikClient;
	lastCall: () => Record<string, unknown> | undefined;
}

function createMockAuthentik(
	createUserImpl: (input: Record<string, unknown>) => Promise<unknown>,
): MockAuthentik {
	let last: Record<string, unknown> | undefined;
	const authentik = {
		async createUser(input: Record<string, unknown>) {
			last = input;
			return createUserImpl(input);
		},
	};
	return { authentik: authentik as unknown as AuthentikClient, lastCall: () => last };
}

const context = {
	firstName: "Jane",
	lastName: "Doe",
	gender: "FEMALE",
	email: "jane.doe@example.com",
	grossSalary: 5000,
	salaryPerDay: 200,
};

test("creates the Authentik account in the employee group with mustChangePassword true", async () => {
	const { authentik, lastCall } = createMockAuthentik(async () => ({
		pk: 1,
		username: "jane.doe@example.com",
		email: "jane.doe@example.com",
	}));
	const useCase = new CreateAuthentikAccountUseCase({ authentik }, () => "fixed-temp-password");

	const result = await useCase.execute(context);

	expect(result.temporaryPassword).toBe("fixed-temp-password");
	expect(lastCall()).toMatchObject({
		username: "jane.doe@example.com",
		email: "jane.doe@example.com",
		name: "Jane Doe",
		password: "fixed-temp-password",
		groupNames: ["employee"],
		attributes: { mustChangePassword: true },
	});
});

test("throws AUTHENTIK_UNAVAILABLE when the Authentik API call fails", async () => {
	const { authentik } = createMockAuthentik(async () => {
		throw new AuthentikApiError(503, { detail: "Service Unavailable" });
	});
	const useCase = new CreateAuthentikAccountUseCase({ authentik });

	let thrown: unknown;
	try {
		await useCase.execute(context);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(GraphQLError);
	expect((thrown as GraphQLError).extensions?.code).toBe("AUTHENTIK_UNAVAILABLE");
});

test("generates a fresh temporary password by default (not empty, varies per call)", async () => {
	const { authentik } = createMockAuthentik(async () => ({ pk: 1, username: "x", email: "x" }));
	const useCase = new CreateAuthentikAccountUseCase({ authentik });

	const first = await useCase.execute(context);
	const second = await useCase.execute(context);

	expect(first.temporaryPassword?.length).toBeGreaterThan(0);
	expect(first.temporaryPassword).not.toBe(second.temporaryPassword);
});
