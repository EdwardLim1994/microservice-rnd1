import { describe, expect, it } from "vitest";

// Black-box e2e coverage for US-2 (Employee self-service), driven entirely through Apollo
// Router. Expected to fail until FEAT-1 (registerEmployee, used as setup — already merged) and
// FEAT-7 (submitLeave mutation, not yet implemented — leave-subgraph doesn't exist yet) are both
// live.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-2 / FEAT-7 /
// leave-subgraph.api.graphql

const GRAPHQL_URL = process.env.GRAPHQL_URL ?? "http://localhost:4000";
const GRAPHQL_ENDPOINT = `${GRAPHQL_URL}/graphql`;

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee { id }
    }
  }
`;

const SUBMIT_LEAVE_MUTATION = `
  mutation SubmitLeave($input: SubmitLeaveInput!) {
    submitLeave(input: $input) {
      id
      employee { id }
      leaveType
      startDate
      endDate
      reason
      status
      submittedAt
    }
  }
`;

const ASSIGN_SUPERVISOR_MUTATION = `
  mutation AssignSupervisor($input: AssignSupervisorInput!) {
    assignSupervisor(input: $input) { id }
  }
`;

const REVIEW_LEAVE_MUTATION = `
  mutation ReviewLeave($input: ReviewLeaveInput!) {
    reviewLeave(input: $input) { id status }
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

async function registerEmployee() {
	const { body } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
		input: {
			fullName: "Rosa Parks",
			employeeId: uniqueEmployeeId(),
			role: "Analyst",
			department: "Finance",
			grossSalary: 4800,
		},
	});
	const id = body.data?.registerEmployee?.employee?.id;
	if (!id) throw new Error(`Setup failed: could not register employee: ${JSON.stringify(body)}`);
	return id as string;
}

describe("US-2 Employee self-service — FEAT-7 submitLeave — API", () => {
	// [INT-7-1] Valid leave request is persisted with status PENDING
	it("persists a valid leave request with status PENDING", async () => {
		const employeeId = await registerEmployee();

		const { status, body } = await graphql(SUBMIT_LEAVE_MUTATION, {
			input: {
				employeeId,
				leaveType: "ANNUAL",
				startDate: "2026-08-01",
				endDate: "2026-08-05",
				reason: "Family vacation",
			},
		});

		expect(status).toBe(200);
		expect(body.errors).toBeUndefined();
		expect(body.data?.submitLeave).toMatchObject({
			leaveType: "ANNUAL",
			status: "PENDING",
			reason: "Family vacation",
		});
	});

	// [INT-7-2] startDate after endDate returns validation error
	it("returns a validation error when startDate is after endDate", async () => {
		const employeeId = await registerEmployee();

		const { body } = await graphql(SUBMIT_LEAVE_MUTATION, {
			input: {
				employeeId,
				leaveType: "ANNUAL",
				startDate: "2026-08-10",
				endDate: "2026-08-01",
				reason: "Invalid range",
			},
		});

		expect(body.errors).toBeDefined();
	});

	// [INT-7-3] Non-existent employeeId returns not found error
	it("returns a not found error for a non-existent employeeId", async () => {
		const { body } = await graphql(SUBMIT_LEAVE_MUTATION, {
			input: {
				employeeId: "00000000-0000-0000-0000-000000000000",
				leaveType: "MEDICAL",
				startDate: "2026-08-01",
				endDate: "2026-08-02",
				reason: "Sick leave",
			},
		});

		expect(body.errors).toBeDefined();
		expect(body.errors[0].message.toLowerCase()).toMatch(/not found|does not exist/);
	});

	// [INT-7-4] Overlapping approved leave returns conflict error
	it("returns a conflict error for overlapping approved leave", async () => {
		const supervisorId = await registerEmployee();
		const employeeId = await registerEmployee();
		await graphql(ASSIGN_SUPERVISOR_MUTATION, { input: { employeeId, supervisorId } });

		const first = await graphql(SUBMIT_LEAVE_MUTATION, {
			input: {
				employeeId,
				leaveType: "ANNUAL",
				startDate: "2026-09-01",
				endDate: "2026-09-05",
				reason: "First request",
			},
		});
		const leaveRequestId = first.body.data?.submitLeave?.id;

		await graphql(REVIEW_LEAVE_MUTATION, {
			input: { leaveRequestId, supervisorId, decision: "APPROVED" },
		});

		const { body } = await graphql(SUBMIT_LEAVE_MUTATION, {
			input: {
				employeeId,
				leaveType: "ANNUAL",
				startDate: "2026-09-03",
				endDate: "2026-09-04",
				reason: "Overlapping request",
			},
		});

		expect(body.errors).toBeDefined();
		expect(body.errors[0].message.toLowerCase()).toMatch(/conflict|overlap/);
	});

	// Edge case: empty reason
	it("returns a validation error for an empty reason", async () => {
		const employeeId = await registerEmployee();

		const { body } = await graphql(SUBMIT_LEAVE_MUTATION, {
			input: {
				employeeId,
				leaveType: "EMERGENCY",
				startDate: "2026-08-01",
				endDate: "2026-08-01",
				reason: "",
			},
		});

		expect(body.errors).toBeDefined();
	});
});
