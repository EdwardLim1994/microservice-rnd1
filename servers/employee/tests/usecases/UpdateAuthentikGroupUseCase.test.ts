import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import { AuthentikApiError, type AuthentikClient } from "server";
import type { Employee } from "../../generated/prisma";
import UpdateAuthentikGroupUseCase from "../../src/usecases/UpdateAuthentikGroupUseCase";

test("moves the target employee's Authentik account into the supervisor group", async () => {
	const calls: Array<{ username: string; groupNames: string[] }> = [];
	const authentik = {
		updateUserGroups: async (username: string, groupNames: string[]) => {
			calls.push({ username, groupNames });
		},
	} as unknown as AuthentikClient;
	const useCase = new UpdateAuthentikGroupUseCase({ authentik });

	await useCase.execute({
		employeeId: "emp-1",
		supervisorId: "sup-1",
		employee: { id: "sup-1", email: "sup@example.com" } as unknown as Employee,
	});

	expect(calls).toEqual([{ username: "sup@example.com", groupNames: ["supervisor"] }]);
});

test("throws AUTHENTIK_UNAVAILABLE when the Authentik call fails", async () => {
	const authentik = {
		updateUserGroups: async () => {
			throw new AuthentikApiError(503, { detail: "unavailable" });
		},
	} as unknown as AuthentikClient;
	const useCase = new UpdateAuthentikGroupUseCase({ authentik });

	let thrown: unknown;
	try {
		await useCase.execute({
			employeeId: "emp-1",
			supervisorId: "sup-1",
			employee: { id: "sup-1", email: "sup@example.com" } as unknown as Employee,
		});
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(GraphQLError);
	expect((thrown as GraphQLError).extensions?.code).toBe("AUTHENTIK_UNAVAILABLE");
});

test("rethrows a non-Authentik error unchanged", async () => {
	const boom = new Error("boom");
	const authentik = {
		updateUserGroups: async () => {
			throw boom;
		},
	} as unknown as AuthentikClient;
	const useCase = new UpdateAuthentikGroupUseCase({ authentik });

	await expect(
		useCase.execute({
			employeeId: "emp-1",
			supervisorId: "sup-1",
			employee: { id: "sup-1", email: "sup@example.com" } as unknown as Employee,
		}),
	).rejects.toBe(boom);
});
