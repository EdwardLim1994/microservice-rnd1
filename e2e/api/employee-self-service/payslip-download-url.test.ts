import { describe, expect, it } from "vitest";

// Black-box e2e coverage for US-2 (Employee self-service), driven entirely through Apollo
// Router. Expected to fail until FEAT-1 (registerEmployee, used as setup — already merged),
// FEAT-3 (generatePayslips, used as setup — already merged), and FEAT-9 (payslipDownloadURL
// query — not yet implemented) are all live.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-2 / FEAT-9 /
// payroll-subgraph.api.graphql

const GRAPHQL_URL = process.env.GRAPHQL_URL ?? "http://localhost:4000";
const GRAPHQL_ENDPOINT = `${GRAPHQL_URL}/graphql`;

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee { id }
    }
  }
`;

const GENERATE_PAYSLIPS_MUTATION = `
  mutation GeneratePayslips($input: GeneratePayslipsInput!) {
    generatePayslips(input: $input) {
      generated { employee { id } month year }
    }
  }
`;

const PAYSLIP_DOWNLOAD_URL_QUERY = `
  query PayslipDownloadURL($input: GetPayslipURLInput!) {
    payslipDownloadURL(input: $input) {
      url
      expiresAt
    }
  }
`;

async function graphql(query: string, variables: Record<string, unknown>) {
	const res = await fetch(GRAPHQL_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});
	return { status: res.status, body: await res.json() };
}

function uniqueEmployeeId() {
	return `EMP-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function registerAndGeneratePayslip() {
	const { body: registerBody } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
		input: {
			fullName: "Chidi Okafor",
			employeeId: uniqueEmployeeId(),
			role: "Analyst",
			department: "Finance",
			grossSalary: 6100,
		},
	});
	const employeeId = registerBody.data?.registerEmployee?.employee?.id;
	if (!employeeId) {
		throw new Error(`Setup failed: could not register employee: ${JSON.stringify(registerBody)}`);
	}

	const { body: payslipsBody } = await graphql(GENERATE_PAYSLIPS_MUTATION, {
		input: { month: 3, year: 2026 },
	});
	if (!payslipsBody.data?.generatePayslips) {
		throw new Error(`Setup failed: could not generate payslips: ${JSON.stringify(payslipsBody)}`);
	}

	return employeeId as string;
}

describe("US-2 Employee self-service — FEAT-9 payslipDownloadURL — API", () => {
	// [INT-9-1 / E2E-5] Valid request returns a presigned URL with correct expiry
	it("returns a presigned URL and expiry for an existing payslip", async () => {
		const employeeId = await registerAndGeneratePayslip();

		const { status, body } = await graphql(PAYSLIP_DOWNLOAD_URL_QUERY, {
			input: { employeeId, month: 3, year: 2026 },
		});

		expect(status).toBe(200);
		expect(body.errors).toBeUndefined();
		expect(body.data?.payslipDownloadURL).toMatchObject({
			url: expect.any(String),
			expiresAt: expect.any(String),
		});
	});

	// [INT-9-2] Non-existent payslip returns not found error
	it("returns a not found error for a non-existent payslip period", async () => {
		const employeeId = await registerAndGeneratePayslip();

		const { body } = await graphql(PAYSLIP_DOWNLOAD_URL_QUERY, {
			input: { employeeId, month: 1, year: 1999 },
		});

		expect(body.errors).toBeDefined();
		expect(body.errors[0].message.toLowerCase()).toMatch(/not found|does not exist/);
	});

	// Edge case: employeeId does not exist
	it("returns a not found error for a non-existent employeeId", async () => {
		const { body } = await graphql(PAYSLIP_DOWNLOAD_URL_QUERY, {
			input: { employeeId: "00000000-0000-0000-0000-000000000000", month: 3, year: 2026 },
		});

		expect(body.errors).toBeDefined();
	});
});
