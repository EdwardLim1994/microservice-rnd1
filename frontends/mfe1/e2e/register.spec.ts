import { expect, test } from '@playwright/test';

// Confirms account creation directly against Authentik's Admin API — the same service-account
// token servers/auth/.env's AUTHENTIK_API_TOKEN holds (view_user permission, provisioned by
// services/authentik/ansible). Not committed anywhere; must be present in the environment running
// this suite (see .github/workflows/e2e-tests.yml).
const AUTHENTIK_URL = process.env.AUTHENTIK_URL ?? 'http://localhost:9000';
const AUTHENTIK_API_TOKEN = process.env.AUTHENTIK_API_TOKEN;

async function userExistsInAuthentik(email: string): Promise<boolean> {
	if (!AUTHENTIK_API_TOKEN) {
		throw new Error('AUTHENTIK_API_TOKEN must be set to verify account creation in Authentik');
	}
	const response = await fetch(
		`${AUTHENTIK_URL}/api/v3/core/users/?username=${encodeURIComponent(email)}`,
		{ headers: { Authorization: `Bearer ${AUTHENTIK_API_TOKEN}` } },
	);
	const body = (await response.json()) as { pagination: { count: number } };
	return body.pagination.count > 0;
}

function uniqueEmail(label: string): string {
	return `e2e-${label}-${Date.now()}@example.com`;
}

test.describe('User Registration (US1)', () => {
	test('Scenario 1: a valid email and password creates a real Authentik account', async ({
		page,
	}) => {
		const email = uniqueEmail('valid');

		await page.goto('/register');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill('SuperSecret123!');
		await page.getByRole('button', { name: 'Register' }).click();

		await expect(page.getByText('Account created successfully')).toBeVisible();
		await expect.poll(() => userExistsInAuthentik(email)).toBe(true);
	});

	test('Scenario 2: a duplicate email shows a duplicate-email error', async ({ page }) => {
		const email = uniqueEmail('dup');

		// First registration establishes the account this scenario needs to collide with.
		await page.goto('/register');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill('SuperSecret123!');
		await page.getByRole('button', { name: 'Register' }).click();
		await expect(page.getByText('Account created successfully')).toBeVisible();

		await page.goto('/register');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill('AnotherSecret123!');
		await page.getByRole('button', { name: 'Register' }).click();

		await expect(page.getByRole('alert')).toHaveText(/already exists/i);
	});

	test('Scenario 3: an empty email shows a validation error and never calls the mutation', async ({
		page,
	}) => {
		let mutationCalled = false;
		await page.route('**/graphql', async (route) => {
			mutationCalled = true;
			await route.continue();
		});

		await page.goto('/register');
		await page.getByLabel('Password').fill('SuperSecret123!');
		await page.getByRole('button', { name: 'Register' }).click();

		await expect(page.getByRole('alert')).toHaveText(/email and password are required/i);
		expect(mutationCalled).toBe(false);
	});

	test('Scenario 4: an empty password shows a validation error and never calls the mutation', async ({
		page,
	}) => {
		let mutationCalled = false;
		await page.route('**/graphql', async (route) => {
			mutationCalled = true;
			await route.continue();
		});

		await page.goto('/register');
		await page.getByLabel('Email').fill(uniqueEmail('nopass'));
		await page.getByRole('button', { name: 'Register' }).click();

		await expect(page.getByRole('alert')).toHaveText(/email and password are required/i);
		expect(mutationCalled).toBe(false);
	});
});
