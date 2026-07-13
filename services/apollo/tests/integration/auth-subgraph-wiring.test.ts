// Issue #18 [INT-FEAT02-01/02]: no `services/*/tests` precedent exists anywhere in the repo yet
// (checked before writing this), and `services/apollo` has no `@rstest/core` configured (unlike
// `packages/server`/`packages/api` — see their `tests/*.test.ts`). This feature's "component" is
// infra config (Apollo Router supergraph composition), not a specific server, so per QA SOP
// judgement this uses Bun's built-in test runner (`bun:test`) directly, invoked via a new
// `services/apollo/package.json` `"test"` script, rather than pulling in a framework this
// workspace doesn't otherwise use.
//
// EXPECTED TO FAIL right now: `services/apollo/src/config/supergraph.yaml` lists `auth` as a
// subgraph to compose, but the composed output actually mounted by the router
// (`services/apollo/dist/supergraph.graphql` for docker-compose,
// `services/apollo/helm/files/supergraph.graphql` for k8s) has never been (re)generated since —
// its `join__Graph` enum only contains `TEST1`/`TEST2`, no `AUTH`. So the router has no idea the
// `signIn`/`register`/`signOut` mutations (the actual GraphQL field names behind this issue's
// business-language "register"/"login"/"logout" — see `servers/auth/src/schemas/graphql/
// auth.graphql`) exist at all, and rejects them at the schema-validation layer before ever
// reaching the auth subgraph.
//
// `signUp` originally covered "register" here — updated to `register` once FEAT-01 (#17) actually
// replaced that mutation on the auth subgraph.

import { $ } from 'bun';
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROUTER_URL = process.env.APOLLO_ROUTER_URL ?? 'http://localhost:4000/graphql';
const REACHABILITY_TIMEOUT_MS = 3000;

// test.skipIf(condition) needs `condition` known at registration time (module load), before any
// beforeAll hook runs — so the reachability probe itself has to happen at module scope via
// top-level await (Bun's ESM loader supports it), same convention
// services/authentik/tests/integration/enrollment-and-auth-flows.test.ts uses. Requires a running
// local stack (`docker compose up`) — CI has none, so these 3 tests skip gracefully there instead
// of failing on ConnectionRefused.
let routerReachable = false;
try {
	const response = await fetch(ROUTER_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ query: '{ __typename }' }),
		signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
	});
	routerReachable = response.ok || response.status === 400;
} catch {
	routerReachable = false;
}

const APOLLO_ROOT = join(import.meta.dir, '../..');
const SUPERGRAPH_CONFIG_PATH = join(APOLLO_ROOT, 'src/config/supergraph.yaml');
const COMPOSE_OUTPUT_PATH = join(APOLLO_ROOT, 'dist/supergraph-integration-test.graphql');

type GraphqlResponseBody = {
	data?: unknown;
	errors?: Array<{ message?: unknown; [key: string]: unknown }>;
};

async function postGraphql(query: string, variables: Record<string, unknown>) {
	const response = await fetch(ROUTER_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ query, variables }),
	});
	const body = (await response.json()) as GraphqlResponseBody;
	return { status: response.status, body };
}

// A "reached the subgraph" response is either real `data`, or a structured GraphQL error object
// (`{ errors: [{ message: string, ... }] }`) coming back from a query the router actually
// executed — e.g. the auth subgraph itself returning INVALID_CREDENTIALS. What it must NOT be is
// a schema-validation error, which means the router rejected the query before it ever left the
// router (the mutation isn't part of the composed schema at all).
function hasDataOrStructuredError(body: GraphqlResponseBody): boolean {
	const hasData = body.data !== undefined && body.data !== null;
	const hasStructuredErrors =
		Array.isArray(body.errors) &&
		body.errors.length > 0 &&
		body.errors.every((error) => typeof error?.message === 'string');
	return hasData || hasStructuredErrors;
}

function isUnknownFieldError(body: GraphqlResponseBody, fieldName: string): boolean {
	if (!Array.isArray(body.errors)) return false;
	const needle = `cannot query field "${fieldName.toLowerCase()}"`;
	return body.errors.some(
		(error) => typeof error?.message === 'string' && error.message.toLowerCase().includes(needle),
	);
}

describe('[INT-FEAT02-01] auth mutations reachable via Apollo Router', () => {
	test.skipIf(!routerReachable)('register reaches the auth subgraph', async () => {
		const { body } = await postGraphql(
			`mutation Register($email: String!, $password: String!) {
				register(email: $email, password: $password) {
					success
					message
				}
			}`,
			{
				email: 'qa-integration-test-user@example.com',
				password: 'Test-Password-123!',
			},
		);

		expect(isUnknownFieldError(body, 'register')).toBe(false);
		expect(hasDataOrStructuredError(body)).toBe(true);
	});

	// "login" in issue #18's business language == the `signIn` mutation on the auth subgraph.
	test.skipIf(!routerReachable)('login (signIn) reaches the auth subgraph', async () => {
		const { body } = await postGraphql(
			`mutation SignIn($username: String!, $password: String!) {
				signIn(username: $username, password: $password) {
					accessToken
					tokenType
					expiresIn
				}
			}`,
			{
				username: 'qa-integration-test-user',
				password: 'Test-Password-123!',
			},
		);

		expect(isUnknownFieldError(body, 'signIn')).toBe(false);
		expect(hasDataOrStructuredError(body)).toBe(true);
	});

	// "logout" in issue #18's business language == the `signOut` mutation on the auth subgraph.
	test.skipIf(!routerReachable)('logout (signOut) reaches the auth subgraph', async () => {
		const { body } = await postGraphql(
			`mutation SignOut($refreshToken: String!) {
				signOut(refreshToken: $refreshToken)
			}`,
			{
				refreshToken: 'qa-integration-test-dummy-refresh-token',
			},
		);

		expect(isUnknownFieldError(body, 'signOut')).toBe(false);
		expect(hasDataOrStructuredError(body)).toBe(true);
	});
});

describe('[INT-FEAT02-02] schema composition succeeds', () => {
	const roverAvailable = Boolean(Bun.which('rover'));

	afterAll(async () => {
		if (roverAvailable) {
			await $`rm -f ${COMPOSE_OUTPUT_PATH}`.nothrow();
		}
	});

	// Skipped gracefully (not failed) when `rover` isn't installed in the test environment — see
	// `services/apollo/CLAUDE.md`'s Dependencies section (`@apollo/rover`).
	test.skipIf(!roverAvailable)(
		'rover supergraph compose exits 0 with no type conflicts',
		async () => {
			await mkdir(join(APOLLO_ROOT, 'dist'), { recursive: true });

			// Same command `services/apollo/src/scripts/compose_supergraph.sh.ts` shells out to
			// (minus that script's server-spawning/wait step, which only matters for exercising
			// `routing_url` reachability at runtime — composition itself only reads each
			// subgraph's local `schema.file`, so no server needs to be running here).
			const result =
				await $`rover supergraph compose --config ${SUPERGRAPH_CONFIG_PATH} --output ${COMPOSE_OUTPUT_PATH} --elv2-license=accept`
					.cwd(APOLLO_ROOT)
					.nothrow();

			expect(result.exitCode).toBe(0);
		},
	);

	test.skipIf(roverAvailable)('rover CLI not available in this environment — skipped', () => {
		expect(roverAvailable).toBe(false);
	});
});
