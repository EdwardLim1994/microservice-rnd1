import { expect, test } from "@rstest/core";
import type EmployeeServiceClient from "../../src/clients/EmployeeServiceClient";
import type PayrollServiceClient from "../../src/clients/PayrollServiceClient";
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
			return options.leaveRequest === undefined ? pendingLeaveRequest : options.leaveRequest;
		},
		async review(id: string, decision: string, reviewedById: string) {
			const record = { ...pendingLeaveRequest, status: decision, reviewedById, reviewedAt: new Date() };
			reviewed.push(record);
			return record;
		},
	};
	return { repo: repo as unknown as LeaveRequestRepository, reviewed: () => reviewed };
}

function createMockEmployeeClient(employeesById: Record<string, { id: string; supervisorId: string | null } | null>) {
	return {
		findEmployee: async (id: string) => (id in employeesById ? employeesById[id] : null),
	} as unknown as EmployeeServiceClient;
}

function createMockPayrollClient() {
	const notifications: { employeeId: string; message: string }[] = [];
	return {
		client: {
			createNotification: async (employeeId: string, message: string) => {
				notifications.push({ employeeId, message });
			},
		} as unknown as PayrollServiceClient,
		notifications: () => notifications,
	};
}

test("INT-8-1: supervisor approves pending leave — status updates to APPROVED", async () => {
	const { repo } = createMockRepo();
	const { client } = createMockPayrollClient();
	const useCase = new ReviewLeaveUseCase({
		leaveRequestRepository: repo,
		employeeServiceClient: createMockEmployeeClient({
			sup1: { id: "sup1", supervisorId: null },
			"emp-1": { id: "emp-1", supervisorId: "sup1" },
		}),
		payrollServiceClient: client,
	});

	const result = (await useCase.execute({
		input: { leaveRequestId: "leave-1", supervisorId: "sup1", decision: "APPROVED" },
	})) as { status: string };

	expect(result.status).toBe("APPROVED");
});

test("INT-8-2: supervisor rejects pending leave — status updates to REJECTED", async () => {
	const { repo } = createMockRepo();
	const { client } = createMockPayrollClient();
	const useCase = new ReviewLeaveUseCase({
		leaveRequestRepository: repo,
		employeeServiceClient: createMockEmployeeClient({
			sup1: { id: "sup1", supervisorId: null },
			"emp-1": { id: "emp-1", supervisorId: "sup1" },
		}),
		payrollServiceClient: client,
	});

	const result = (await useCase.execute({
		input: { leaveRequestId: "leave-1", supervisorId: "sup1", decision: "REJECTED" },
	})) as { status: string };

	expect(result.status).toBe("REJECTED");
});

test("INT-8-3: non-supervisor attempts review — returns forbidden error", async () => {
	const { repo } = createMockRepo();
	const { client } = createMockPayrollClient();
	const useCase = new ReviewLeaveUseCase({
		leaveRequestRepository: repo,
		employeeServiceClient: createMockEmployeeClient({
			other: { id: "other", supervisorId: null },
			"emp-1": { id: "emp-1", supervisorId: "sup1" },
		}),
		payrollServiceClient: client,
	});

	await expect(
		useCase.execute({ input: { leaveRequestId: "leave-1", supervisorId: "other", decision: "APPROVED" } }),
	).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
});

test("INT-8-4: reviewing already-approved leave returns conflict error", async () => {
	const { repo } = createMockRepo({ leaveRequest: { ...pendingLeaveRequest, status: "APPROVED" } });
	const { client } = createMockPayrollClient();
	const useCase = new ReviewLeaveUseCase({
		leaveRequestRepository: repo,
		employeeServiceClient: createMockEmployeeClient({
			sup1: { id: "sup1", supervisorId: null },
		}),
		payrollServiceClient: client,
	});

	await expect(
		useCase.execute({ input: { leaveRequestId: "leave-1", supervisorId: "sup1", decision: "APPROVED" } }),
	).rejects.toMatchObject({ extensions: { code: "CONFLICT" } });
});

test("non-existent leaveRequestId returns not found error", async () => {
	const { repo } = createMockRepo({ leaveRequest: null });
	const { client } = createMockPayrollClient();
	const useCase = new ReviewLeaveUseCase({
		leaveRequestRepository: repo,
		employeeServiceClient: createMockEmployeeClient({}),
		payrollServiceClient: client,
	});

	await expect(
		useCase.execute({ input: { leaveRequestId: "missing", supervisorId: "sup1", decision: "APPROVED" } }),
	).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
});

test("non-existent supervisorId returns not found error", async () => {
	const { repo } = createMockRepo();
	const { client } = createMockPayrollClient();
	const useCase = new ReviewLeaveUseCase({
		leaveRequestRepository: repo,
		employeeServiceClient: createMockEmployeeClient({}),
		payrollServiceClient: client,
	});

	await expect(
		useCase.execute({ input: { leaveRequestId: "leave-1", supervisorId: "missing", decision: "APPROVED" } }),
	).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
});

test("creates a notification for the employee on successful review", async () => {
	const { repo } = createMockRepo();
	const { client, notifications } = createMockPayrollClient();
	const useCase = new ReviewLeaveUseCase({
		leaveRequestRepository: repo,
		employeeServiceClient: createMockEmployeeClient({
			sup1: { id: "sup1", supervisorId: null },
			"emp-1": { id: "emp-1", supervisorId: "sup1" },
		}),
		payrollServiceClient: client,
	});

	await useCase.execute({ input: { leaveRequestId: "leave-1", supervisorId: "sup1", decision: "APPROVED" } });

	expect(notifications()).toHaveLength(1);
	expect(notifications()[0]?.employeeId).toBe("emp-1");
});
