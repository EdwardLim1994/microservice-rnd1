import { describe, expect, it } from "vitest";

// Black-box e2e coverage for US-2 (Employee self-service), driven entirely through Apollo
// Router. Expected to fail until FEAT-1/FEAT-2 (registerEmployee/assignSupervisor, already
// merged), FEAT-7 (submitLeave), and FEAT-8 (reviewLeave — not yet implemented) are all live.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-2 / FEAT-8 /
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

const ASSIGN_SUPERVISOR_MUTATION = `
  mutation AssignSupervisor($input: AssignSupervisorInput!) {
    assignSupervisor(input: $input) { id }
  }
`;

const SUBMIT_LEAVE_MUTATION = `
  mutation SubmitLeave($input: SubmitLeaveInput!) {
    submitLeave(input: $input) { id status }
  }
`;

const REVIEW_LEAVE_MUTATION = `
  mutation ReviewLeave($input: ReviewLeaveInput!) {
    reviewLeave(input: $input) {
      id
      status
      reviewedAt
      reviewedBy { id }
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

async function registerEmployee(fullName: string) {
	const { body } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
		input: {
			fullName,
			employeeId: uniqueEmployeeId(),
			role: "Engineer",
			department: "Engineering",
			grossSalary: 5200,
		},
	});
	const id = body.data?.registerEmployee?.employee?.id;
	if (!id) throw new Error(`Setup failed: could not register employee: ${JSON.stringify(body)}`);
	return id as string;
}

async function setupPendingLeave() {
	const supervisorId = await registerEmployee("Wanjiru Njoroge");
	const employeeId = await registerEmployee("Kofi Mensah");
	await graphql(ASSIGN_SUPERVISOR_MUTATION, { input: { employeeId, supervisorId } });
	const { body } = await graphql(SUBMIT_LEAVE_MUTATION, {
		input: {
			employeeId,
			leaveType: "ANNUAL",
			startDate: "2026-10-01",
			endDate: "2026-10-03",
			reason: "Trip",
		},
	});
	const leaveRequestId = body.data?.submitLeave?.id;
	if (!leaveRequestId) {
		throw new Error(`Setup failed: could not submit leave: ${JSON.stringify(body)}`);
	}
	return { supervisorId, employeeId, leaveRequestId };
}

describe("US-2 Employee self-service — FEAT-8 reviewLeave — API", () => {
	// [INT-8-1 / E2E-3] Supervisor approves pending leave
	it("approves a pending leave request", async () => {
		const { supervisorId, leaveRequestId } = await setupPendingLeave();

		const { status, body } = await graphql(REVIEW_LEAVE_MUTATION, {
			input: { leaveRequestId, supervisorId, decision: "APPROVED" },
		});

		expect(status).toBe(200);
		expect(body.errors).toBeUndefined();
		expect(body.data?.reviewLeave?.status).toBe("APPROVED");
	});

	// [INT-8-2 / E2E-4] Supervisor rejects pending leave
	it("rejects a pending leave request", async () => {
		const { supervisorId, leaveRequestId } = await setupPendingLeave();

		const { body } = await graphql(REVIEW_LEAVE_MUTATION, {
			input: { leaveRequestId, supervisorId, decision: "REJECTED" },
		});

		expect(body.data?.reviewLeave?.status).toBe("REJECTED");
	});

	// [INT-8-3] Non-supervisor attempts review — returns forbidden error
	it("returns a forbidden error when the reviewer is not the direct supervisor", async () => {
		const { leaveRequestId } = await setupPendingLeave();
		const notTheSupervisorId = await registerEmployee("Unrelated Person");

		const { body } = await graphql(REVIEW_LEAVE_MUTATION, {
			input: { leaveRequestId, supervisorId: notTheSupervisorId, decision: "APPROVED" },
		});

		expect(body.errors).toBeDefined();
		expect(body.errors[0].message.toLowerCase()).toMatch(/forbidden|not.*supervisor/);
	});

	// [INT-8-4] Reviewing already-approved leave returns conflict error
	it("returns a conflict error when reviewing an already-reviewed request", async () => {
		const { supervisorId, leaveRequestId } = await setupPendingLeave();
		await graphql(REVIEW_LEAVE_MUTATION, {
			input: { leaveRequestId, supervisorId, decision: "APPROVED" },
		});

		const { body } = await graphql(REVIEW_LEAVE_MUTATION, {
			input: { leaveRequestId, supervisorId, decision: "REJECTED" },
		});

		expect(body.errors).toBeDefined();
	});

	// Edge case: leaveRequestId does not exist
	it("returns a not found error for a non-existent leaveRequestId", async () => {
		const supervisorId = await registerEmployee("Some Supervisor");

		const { body } = await graphql(REVIEW_LEAVE_MUTATION, {
			input: {
				leaveRequestId: "00000000-0000-0000-0000-000000000000",
				supervisorId,
				decision: "APPROVED",
			},
		});

		expect(body.errors).toBeDefined();
	});
});
