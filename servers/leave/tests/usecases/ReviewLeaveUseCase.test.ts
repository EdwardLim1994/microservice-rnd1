import { expect, test } from "@rstest/core";
import type LeaveRequestRepository from "../../src/repositories/LeaveRequestRepository";
import ReviewLeaveUseCase from "../../src/usecases/ReviewLeaveUseCase";

const pendingLeaveRequest = {
	id: "leave-1",
	employeeId: "emp-1",
	leaveType: "ANNUAL",
	startDate: new Date("2026-08-01"),
	endDate: new Date("2026-08-05"),
	reason: "Trip",
	status: "PENDING",
	submittedAt: new Date(),
	reviewedById: null,
	reviewedAt: null,
};

function createMockRepo(options: { leaveRequest?: unknown } = {}) {
	const reviewed: unknown[] = [];
	const repo = {
		async findById() {
			return options.leaveRequest === undefined
				? pendingLeaveRequest
				: options.leaveRequest;
		},
		async review(_id: string, decision: string, reviewedById: string) {
			const record = {
				...pendingLeaveRequest,
				status: decision,
				reviewedById,
				reviewedAt: new Date(),
			};
			reviewed.push(record);
			return record;
		},
	};
	return {
		repo: repo as unknown as LeaveRequestRepository,
		reviewed: () => reviewed,
	};
}

// EmployeeServiceClient/PayrollServiceClient are constructed internally by ReviewLeaveUseCase
// (not injected) — stub global fetch instead, same convention as payroll's
// GeneratePayslipsUseCase.test.ts. Routes by request body: employee-subgraph's Employee query
// (keyed by employeesById) vs. payroll-subgraph's createNotification mutation (tracked in calls).
function stubFetch(
	employeesById: Record<
		string,
		{ id: string; supervisorId: string | null } | null
	>,
) {
	const notifications: { employeeId: string; message: string }[] = [];
	globalThis.fetch = (async (_url: string, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body ?? "{}")) as {
			query: string;
			variables?: Record<string, unknown>;
		};
		if (body.query.includes("query Employee(")) {
			const id = body.variables?.id as string;
			const employee = id in employeesById ? employeesById[id] : null;
			const data = employee
				? {
						employee: {
							id: employee.id,
							supervisor: employee.supervisorId
								? { id: employee.supervisorId }
								: null,
						},
					}
				: { employee: null };
			return new Response(JSON.stringify({ data }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		if (body.query.includes("mutation CreateNotification")) {
			const input = (body.variables?.input ?? {}) as {
				employeeId: string;
				message: string;
			};
			notifications.push(input);
			return new Response(
				JSON.stringify({ data: { createNotification: { id: "notif-1" } } }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
		throw new Error(`stubFetch: unexpected query: ${body.query}`);
	}) as unknown as typeof fetch;
	return { notifications: () => notifications };
}

test("INT-8-1: supervisor approves pending leave — status updates to APPROVED", async () => {
	stubFetch({
		sup1: { id: "sup1", supervisorId: null },
		"emp-1": { id: "emp-1", supervisorId: "sup1" },
	});
	const { repo } = createMockRepo();
	const useCase = new ReviewLeaveUseCase({ leaveRequestRepository: repo });

	const result = (await useCase.execute({
		input: {
			leaveRequestId: "leave-1",
			supervisorId: "sup1",
			decision: "APPROVED",
		},
	})) as { status: string };

	expect(result.status).toBe("APPROVED");
});

test("INT-8-2: supervisor rejects pending leave — status updates to REJECTED", async () => {
	stubFetch({
		sup1: { id: "sup1", supervisorId: null },
		"emp-1": { id: "emp-1", supervisorId: "sup1" },
	});
	const { repo } = createMockRepo();
	const useCase = new ReviewLeaveUseCase({ leaveRequestRepository: repo });

	const result = (await useCase.execute({
		input: {
			leaveRequestId: "leave-1",
			supervisorId: "sup1",
			decision: "REJECTED",
		},
	})) as { status: string };

	expect(result.status).toBe("REJECTED");
});

test("INT-8-3: non-supervisor attempts review — returns forbidden error", async () => {
	stubFetch({
		other: { id: "other", supervisorId: null },
		"emp-1": { id: "emp-1", supervisorId: "sup1" },
	});
	const { repo } = createMockRepo();
	const useCase = new ReviewLeaveUseCase({ leaveRequestRepository: repo });

	await expect(
		useCase.execute({
			input: {
				leaveRequestId: "leave-1",
				supervisorId: "other",
				decision: "APPROVED",
			},
		}),
	).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
});

test("INT-8-4: reviewing already-approved leave returns conflict error", async () => {
	stubFetch({ sup1: { id: "sup1", supervisorId: null } });
	const { repo } = createMockRepo({
		leaveRequest: { ...pendingLeaveRequest, status: "APPROVED" },
	});
	const useCase = new ReviewLeaveUseCase({ leaveRequestRepository: repo });

	await expect(
		useCase.execute({
			input: {
				leaveRequestId: "leave-1",
				supervisorId: "sup1",
				decision: "APPROVED",
			},
		}),
	).rejects.toMatchObject({ extensions: { code: "CONFLICT" } });
});

test("non-existent leaveRequestId returns not found error", async () => {
	stubFetch({});
	const { repo } = createMockRepo({ leaveRequest: null });
	const useCase = new ReviewLeaveUseCase({ leaveRequestRepository: repo });

	await expect(
		useCase.execute({
			input: {
				leaveRequestId: "missing",
				supervisorId: "sup1",
				decision: "APPROVED",
			},
		}),
	).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
});

test("non-existent supervisorId returns not found error", async () => {
	stubFetch({});
	const { repo } = createMockRepo();
	const useCase = new ReviewLeaveUseCase({ leaveRequestRepository: repo });

	await expect(
		useCase.execute({
			input: {
				leaveRequestId: "leave-1",
				supervisorId: "missing",
				decision: "APPROVED",
			},
		}),
	).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
});

test("creates a notification for the employee on successful review", async () => {
	const { notifications } = stubFetch({
		sup1: { id: "sup1", supervisorId: null },
		"emp-1": { id: "emp-1", supervisorId: "sup1" },
	});
	const { repo } = createMockRepo();
	const useCase = new ReviewLeaveUseCase({ leaveRequestRepository: repo });

	await useCase.execute({
		input: {
			leaveRequestId: "leave-1",
			supervisorId: "sup1",
			decision: "APPROVED",
		},
	});

	expect(notifications()).toHaveLength(1);
	expect(notifications()[0]?.employeeId).toBe("emp-1");
});
