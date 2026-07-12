import { expect, test } from "@rstest/core";
import { AuthentikApiError, type AuthentikClient } from "server";
import RegisterUseCase from "../../src/usecases/RegisterUseCase";

function makeUseCase(enroll: AuthentikClient["enroll"]) {
	const authentik = { enroll } as unknown as AuthentikClient;
	return new RegisterUseCase({ authentik });
}

test("returns success on a valid registration", async () => {
	const useCase = makeUseCase(async () => undefined);
	const result = await useCase.execute({ email: "new@example.com", password: "SuperSecret123!" });
	expect(result).toEqual({ success: true, message: "Account created successfully" });
});

test("rejects an empty email at the resolver level, before calling authentik", async () => {
	let called = false;
	const useCase = makeUseCase(async () => {
		called = true;
	});
	await expect(useCase.execute({ email: "", password: "SuperSecret123!" })).rejects.toThrow(
		/valid email and non-empty password/i,
	);
	expect(called).toBe(false);
});

test("rejects an empty password at the resolver level, before calling authentik", async () => {
	let called = false;
	const useCase = makeUseCase(async () => {
		called = true;
	});
	await expect(useCase.execute({ email: "new@example.com", password: "" })).rejects.toThrow(
		/valid email and non-empty password/i,
	);
	expect(called).toBe(false);
});

test("rejects a malformed email at the resolver level, before calling authentik", async () => {
	let called = false;
	const useCase = makeUseCase(async () => {
		called = true;
	});
	await expect(
		useCase.execute({ email: "not-an-email", password: "SuperSecret123!" }),
	).rejects.toThrow(/valid email and non-empty password/i);
	expect(called).toBe(false);
});

test("surfaces a duplicate-email error when authentik denies with ak-stage-access-denied", async () => {
	const useCase = makeUseCase(async () => {
		throw new AuthentikApiError(422, {
			component: "ak-stage-access-denied",
			error_message: "Failed to update user. Please try again later.",
		});
	});
	await expect(
		useCase.execute({ email: "dup@example.com", password: "SuperSecret123!" }),
	).rejects.toThrow(/already exists/i);
});

test("surfaces authentik's own password policy message on a rejected password", async () => {
	const useCase = makeUseCase(async () => {
		throw new AuthentikApiError(422, {
			component: "ak-stage-prompt",
			response_errors: {
				non_field_errors: [{ string: "Password needs to be 8 characters or longer.", code: "invalid" }],
			},
		});
	});
	await expect(
		useCase.execute({ email: "weak@example.com", password: "abc12345" }),
	).rejects.toThrow(/8 characters or longer/);
});

test("falls back to a generic unavailable error when authentik is unreachable", async () => {
	const useCase = makeUseCase(async () => {
		throw new AuthentikApiError(503, { detail: "connection refused" });
	});
	await expect(
		useCase.execute({ email: "new@example.com", password: "SuperSecret123!" }),
	).rejects.toThrow(/unavailable/i);
});

test("falls back to a generic unavailable error on a non-AuthentikApiError failure", async () => {
	const useCase = makeUseCase(async () => {
		throw new Error("network error");
	});
	await expect(
		useCase.execute({ email: "new@example.com", password: "SuperSecret123!" }),
	).rejects.toThrow(/unavailable/i);
});
