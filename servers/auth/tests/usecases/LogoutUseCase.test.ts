import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import { AuthentikApiError, type AuthentikClient } from "server";
import LogoutUseCase from "../../src/usecases/LogoutUseCase";

// Manual test double — rstest has no vi.fn()/module mocking (see packages/server/CLAUDE.md's
// Testing section: "vi is NOT exported from @rstest/core. Use manual test doubles instead of
// module mocking."), so call tracking is done by hand via a counter/flag on the mock object
// itself, same pattern as AuthentikAuthInterceptor.test.ts's makeMockGrpcServer(). Only exposes
// the one method LogoutUseCase needs — full RP-initiated logout isn't just revokeToken(), so this
// deliberately does not reuse that existing AuthentikClient method name, matching the class's
// verb-based naming style (signIn, revokeToken, createUser) instead.
function createMockAuthentik(logoutImpl: (accessToken: string) => Promise<void>): {
	authentik: AuthentikClient;
	calls: { logout: number; lastAccessToken?: string };
} {
	const calls: { logout: number; lastAccessToken?: string } = { logout: 0, lastAccessToken: undefined };
	const authentik = {
		async logout(accessToken: string): Promise<void> {
			calls.logout += 1;
			calls.lastAccessToken = accessToken;
			return logoutImpl(accessToken);
		},
	} as unknown as AuthentikClient;
	return { authentik, calls };
}

// INT-FEAT07-01 — valid logout via a valid access token.
test("valid access token logs out successfully", async () => {
	const { authentik, calls } = createMockAuthentik(async () => undefined);
	const useCase = new LogoutUseCase({ authentik });

	const result = await useCase.execute({ accessToken: "valid-access-token" });

	expect(result.success).toBe(true);
	expect(typeof result.message).toBe("string");
	expect(calls.logout).toBe(1);
	expect(calls.lastAccessToken).toBe("valid-access-token");
});

// Edge case — Authentik API is unreachable (a genuine transport failure, not a non-2xx HTTP
// response — AuthentikClient's fetch-based methods only throw AuthentikApiError for the latter).
test("authentik unreachable throws a service-unavailable GraphQLError", async () => {
	const { authentik, calls } = createMockAuthentik(async () => {
		throw new TypeError("fetch failed");
	});
	const useCase = new LogoutUseCase({ authentik });

	await expect(useCase.execute({ accessToken: "valid-access-token" })).rejects.toThrow(GraphQLError);

	try {
		await useCase.execute({ accessToken: "valid-access-token" });
		throw new Error("expected execute() to throw");
	} catch (error) {
		expect(error).toBeInstanceOf(GraphQLError);
		const graphqlError = error as GraphQLError;
		expect(String(graphqlError.extensions?.code)).toMatch(/UNAVAILABLE/i);
	}
	expect(calls.logout).toBe(2);
});

// INT-FEAT07-02 — already-invalidated / expired token.
test("expired or already-invalidated token throws a clear invalid-token GraphQLError", async () => {
	const { authentik } = createMockAuthentik(async () => {
		throw new AuthentikApiError(401, { error: "invalid_token" });
	});
	const useCase = new LogoutUseCase({ authentik });

	try {
		await useCase.execute({ accessToken: "expired-access-token" });
		throw new Error("expected execute() to throw");
	} catch (error) {
		expect(error).toBeInstanceOf(GraphQLError);
		const graphqlError = error as GraphQLError;
		expect(String(graphqlError.extensions?.code)).toMatch(/INVALID.*TOKEN/i);
		// Never leak Authentik's raw error body back to the client — same rationale as
		// SignInUseCase's INVALID_CREDENTIALS branch.
		expect(graphqlError.message).not.toContain("invalid_token");
	}
});

// Edge case — Authentik returns an unexpected/malformed response on the logout call. Modeled as
// the client throwing something that is neither an AuthentikApiError nor a recognizable
// transport failure (e.g. its own response-shape parsing gave up on something bizarre) — the use
// case must not let this leak to the client as-is.
test("unexpected authentik response shape throws a generic server-error GraphQLError, not a raw leak", async () => {
	const rawUnexpectedResponse = { unexpected: "shape", internalDetail: "<html>Bad Gateway</html>" };
	const { authentik } = createMockAuthentik(async () => {
		throw rawUnexpectedResponse;
	});
	const useCase = new LogoutUseCase({ authentik });

	try {
		await useCase.execute({ accessToken: "valid-access-token" });
		throw new Error("expected execute() to throw");
	} catch (error) {
		expect(error).toBeInstanceOf(GraphQLError);
		const graphqlError = error as GraphQLError;
		expect(typeof graphqlError.extensions?.code).toBe("string");
		// Must not be reported as the same code as the invalid-token/unavailable branches — this is
		// a distinct, generic failure.
		expect(String(graphqlError.extensions?.code)).not.toMatch(/INVALID.*TOKEN/i);
		expect(String(graphqlError.extensions?.code)).not.toMatch(/UNAVAILABLE/i);
		// The raw response must be logged server-side (per issue #25's spec), never echoed to the
		// client in the error message itself.
		expect(graphqlError.message).not.toContain("unexpected");
		expect(graphqlError.message).not.toContain("Bad Gateway");
	}
});

// INT-FEAT07-03 — empty token string, rejected before ever calling authentik.
test("empty access token is rejected before calling authentik", async () => {
	const { authentik, calls } = createMockAuthentik(async () => undefined);
	const useCase = new LogoutUseCase({ authentik });

	await expect(useCase.execute({ accessToken: "" })).rejects.toThrow(GraphQLError);
	// The mock's own counter, not a spy — confirms authentik.logout() was never invoked for an
	// empty token, per issue #25's "reject at the resolver level before calling authentik".
	expect(calls.logout).toBe(0);
});

// INT-FEAT07-04 — malformed (not empty, but not a well-formed token either) access token.
test("malformed access token throws a structured GraphQLError", async () => {
	const { authentik } = createMockAuthentik(async () => {
		throw new AuthentikApiError(400, { error: "invalid_request", error_description: "malformed token" });
	});
	const useCase = new LogoutUseCase({ authentik });

	try {
		await useCase.execute({ accessToken: "not-a-well-formed-token" });
		throw new Error("expected execute() to throw");
	} catch (error) {
		expect(error).toBeInstanceOf(GraphQLError);
		const graphqlError = error as GraphQLError;
		expect(typeof graphqlError.extensions?.code).toBe("string");
		expect((graphqlError.extensions?.code as string).length).toBeGreaterThan(0);
		expect(typeof graphqlError.message).toBe("string");
		expect(graphqlError.message.length).toBeGreaterThan(0);
	}
});
