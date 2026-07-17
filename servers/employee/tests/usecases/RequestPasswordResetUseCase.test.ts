import { expect, test } from "@rstest/core";
import type { AuthentikClient } from "server";
import RequestPasswordResetUseCase from "../../src/usecases/RequestPasswordResetUseCase";

function createMockAuthentik(impl: (email: string) => Promise<void> = async () => {}) {
	return { requestPasswordReset: impl } as unknown as AuthentikClient;
}

// [INT-10-1] Valid email triggers Authentik reset email and returns success
test("valid email triggers Authentik reset email and returns success", async () => {
	const calls: string[] = [];
	const useCase = new RequestPasswordResetUseCase({
		authentik: createMockAuthentik(async (email) => {
			calls.push(email);
		}),
	});

	const result = await useCase.execute({ input: { email: "employee@example.com" } });

	expect(calls).toEqual(["employee@example.com"]);
	expect(result.success).toBe(true);
});

// [INT-10-2] Unregistered email returns success without leaking account existence
test("unregistered email still returns success (AuthentikClient silently no-ops)", async () => {
	const useCase = new RequestPasswordResetUseCase({
		authentik: createMockAuthentik(async () => {
			// AuthentikClient.requestPasswordReset() itself absorbs a no-match lookup.
		}),
	});

	const result = await useCase.execute({ input: { email: "unknown@example.com" } });

	expect(result.success).toBe(true);
});

test("genuine Authentik failure propagates", async () => {
	const useCase = new RequestPasswordResetUseCase({
		authentik: createMockAuthentik(async () => {
			throw new Error("Authentik unreachable");
		}),
	});

	await expect(useCase.execute({ input: { email: "employee@example.com" } })).rejects.toThrow(
		"Authentik unreachable",
	);
});
