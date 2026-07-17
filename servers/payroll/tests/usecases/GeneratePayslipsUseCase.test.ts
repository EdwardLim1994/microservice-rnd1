import { expect, test } from "@rstest/core";
import GeneratePayslipsUseCase from "../../src/usecases/GeneratePayslipsUseCase";
import type NotificationRepository from "../../src/repositories/NotificationRepository";
import type StorePayslipUseCase from "../../src/usecases/StorePayslipUseCase";

// EmployeeServiceClient is constructed internally by GeneratePayslipsUseCase (not injected) — we
// stub global fetch instead, same "no vi mocking, manual test double" convention as every other
// use case test in this repo (see packages/server/CLAUDE.md's Testing section).
function stubEmployeesFetch(employees: unknown[]) {
	globalThis.fetch = (async () =>
		new Response(JSON.stringify({ data: { employees } }), { status: 200 })) as unknown as typeof fetch;
}

function stubFailingFetch() {
	globalThis.fetch = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
}

function createMockStorePayslipUseCase(impl?: (employeeId: string) => Promise<unknown>) {
	const calls: string[] = [];
	const stored: Record<string, unknown>[] = [];
	const useCase = {
		async execute({ input }: { input: { employeeId: string; month: number; year: number } }) {
			calls.push(input.employeeId);
			if (impl) return impl(input.employeeId);
			const payslip = { id: `payslip-${stored.length + 1}`, ...input };
			stored.push(payslip);
			return payslip;
		},
	};
	return {
		useCase: useCase as unknown as StorePayslipUseCase,
		calls: () => calls,
		stored: () => stored,
	};
}

function createMockNotificationRepository() {
	const notifications: Record<string, unknown>[] = [];
	const notificationRepository = {
		async create(data: Record<string, unknown>) {
			const notification = { id: `notif-${notifications.length + 1}`, read: false, ...data };
			notifications.push(notification);
			return notification;
		},
	};
	return {
		notificationRepository: notificationRepository as unknown as NotificationRepository,
		notifications: () => notifications,
	};
}

// [E2E-2 / INT-3-1] Monthly job generates one payslip PDF per active employee
test("stores a payslip and creates a notification per employee", async () => {
	stubEmployeesFetch([
		{ id: "emp-1", employeeId: "EMP-001", fullName: "Ada Lovelace", role: "Engineer", department: "Eng", grossSalary: 5000 },
	]);
	const { useCase: storePayslipUseCase, calls, stored } = createMockStorePayslipUseCase();
	const { notificationRepository, notifications } = createMockNotificationRepository();
	const useCase = new GeneratePayslipsUseCase({ storePayslipUseCase, notificationRepository });

	const result = (await useCase.execute({ input: { month: 1, year: 2026 } })) as {
		generated: unknown[];
		failed: string[];
	};

	expect(result.generated).toHaveLength(1);
	expect(result.failed).toEqual([]);
	expect(calls()).toEqual(["emp-1"]);
	expect(stored()).toHaveLength(1);
	expect(notifications()).toHaveLength(1);
});

// [INT-3-3] No active employees returns empty list, no error
test("returns an empty generated list without error when there are no employees", async () => {
	stubEmployeesFetch([]);
	const { useCase: storePayslipUseCase } = createMockStorePayslipUseCase();
	const { notificationRepository } = createMockNotificationRepository();
	const useCase = new GeneratePayslipsUseCase({ storePayslipUseCase, notificationRepository });

	const result = (await useCase.execute({ input: { month: 1, year: 2026 } })) as {
		generated: unknown[];
		failed: string[];
	};

	expect(result.generated).toEqual([]);
	expect(result.failed).toEqual([]);
});

// [INT-3-2] Per-employee failure doesn't stop the remaining generation
test("a failure for one employee is reported in failed[] without stopping the rest", async () => {
	stubEmployeesFetch([
		{ id: "emp-1", employeeId: "EMP-001", fullName: "A", role: "Eng", department: "Eng", grossSalary: 5000 },
		{ id: "emp-2", employeeId: "EMP-002", fullName: "B", role: "Eng", department: "Eng", grossSalary: 5000 },
	]);
	let calls = 0;
	const { useCase: storePayslipUseCase } = createMockStorePayslipUseCase(async (employeeId) => {
		calls++;
		if (calls === 1) throw new Error("boom");
		return { id: `payslip-${calls}`, employeeId };
	});
	const { notificationRepository } = createMockNotificationRepository();
	const useCase = new GeneratePayslipsUseCase({ storePayslipUseCase, notificationRepository });

	const result = (await useCase.execute({ input: { month: 1, year: 2026 } })) as {
		generated: unknown[];
		failed: string[];
	};

	expect(result.failed).toEqual(["emp-1"]);
	expect(result.generated).toHaveLength(1);
});

// Edge case: employee service unreachable aborts the job
test("employee service being unreachable throws instead of silently returning empty", async () => {
	stubFailingFetch();
	const { useCase: storePayslipUseCase } = createMockStorePayslipUseCase();
	const { notificationRepository } = createMockNotificationRepository();
	const useCase = new GeneratePayslipsUseCase({ storePayslipUseCase, notificationRepository });

	let thrown: unknown;
	try {
		await useCase.execute({ input: { month: 1, year: 2026 } });
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeDefined();
});
