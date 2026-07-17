import { expect, test } from "@rstest/core";
import type { Client } from "minio";
import GeneratePayslipsUseCase from "../../src/usecases/GeneratePayslipsUseCase";
import type NotificationRepository from "../../src/repositories/NotificationRepository";
import type PayslipRepository from "../../src/repositories/PayslipRepository";

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

function createMockMinio() {
	const uploaded: { bucket: string; key: string }[] = [];
	const minio = {
		async bucketExists() {
			return true;
		},
		async makeBucket() {},
		async putObject(bucket: string, key: string) {
			uploaded.push({ bucket, key });
		},
	};
	return { minio: minio as unknown as Client, uploaded: () => uploaded };
}

function createMockRepos() {
	const payslips: Record<string, unknown>[] = [];
	const notifications: Record<string, unknown>[] = [];
	const payslipRepository = {
		async upsert(data: Record<string, unknown>) {
			const payslip = { id: `payslip-${payslips.length + 1}`, ...data };
			payslips.push(payslip);
			return payslip;
		},
	};
	const notificationRepository = {
		async create(data: Record<string, unknown>) {
			const notification = { id: `notif-${notifications.length + 1}`, read: false, ...data };
			notifications.push(notification);
			return notification;
		},
	};
	return {
		payslipRepository: payslipRepository as unknown as PayslipRepository,
		notificationRepository: notificationRepository as unknown as NotificationRepository,
		payslips: () => payslips,
		notifications: () => notifications,
	};
}

// [E2E-2 / INT-3-1] Monthly job generates one payslip PDF per active employee
test("generates a payslip and notification per employee, uploaded to Minio", async () => {
	stubEmployeesFetch([
		{ id: "emp-1", employeeId: "EMP-001", fullName: "Ada Lovelace", role: "Engineer", department: "Eng", grossSalary: 5000 },
	]);
	const { minio, uploaded } = createMockMinio();
	const { payslipRepository, notificationRepository, payslips, notifications } = createMockRepos();
	const useCase = new GeneratePayslipsUseCase({ payslipRepository, notificationRepository, minio });

	const result = (await useCase.execute({ input: { month: 1, year: 2026 } })) as {
		generated: unknown[];
		failed: string[];
	};

	expect(result.generated).toHaveLength(1);
	expect(result.failed).toEqual([]);
	expect(uploaded()).toHaveLength(1);
	expect(payslips()).toHaveLength(1);
	expect(notifications()).toHaveLength(1);
});

// [INT-3-3] No active employees returns empty list, no error
test("returns an empty generated list without error when there are no employees", async () => {
	stubEmployeesFetch([]);
	const { minio } = createMockMinio();
	const { payslipRepository, notificationRepository } = createMockRepos();
	const useCase = new GeneratePayslipsUseCase({ payslipRepository, notificationRepository, minio });

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
	const { minio } = createMockMinio();
	const { payslipRepository, notificationRepository, payslips } = createMockRepos();
	let calls = 0;
	const flakyPayslipRepository = {
		async upsert(data: { employeeId: string; month: number; year: number; minioObjectKey: string }) {
			calls++;
			if (calls === 1) throw new Error("boom");
			return payslipRepository.upsert(data);
		},
	} as unknown as PayslipRepository;
	const useCase = new GeneratePayslipsUseCase({
		payslipRepository: flakyPayslipRepository,
		notificationRepository,
		minio,
	});

	const result = (await useCase.execute({ input: { month: 1, year: 2026 } })) as {
		generated: unknown[];
		failed: string[];
	};

	expect(result.failed).toEqual(["emp-1"]);
	expect(result.generated).toHaveLength(1);
	expect(payslips()).toHaveLength(1);
});

// Edge case: employee service unreachable aborts the job
test("employee service being unreachable throws instead of silently returning empty", async () => {
	stubFailingFetch();
	const { minio } = createMockMinio();
	const { payslipRepository, notificationRepository } = createMockRepos();
	const useCase = new GeneratePayslipsUseCase({ payslipRepository, notificationRepository, minio });

	let thrown: unknown;
	try {
		await useCase.execute({ input: { month: 1, year: 2026 } });
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeDefined();
});
