import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import type { Client } from "minio";
import type PayslipRepository from "../../src/repositories/PayslipRepository";
import GetPayslipURLUseCase from "../../src/usecases/GetPayslipURLUseCase";

// EmployeeServiceClient is constructed internally by GetPayslipURLUseCase (not injected) — stub
// global fetch instead, same convention as GeneratePayslipsUseCase.test.ts.
function stubEmployeeFetch(employee: { id: string } | null = { id: "emp-1" }) {
	globalThis.fetch = (async () =>
		new Response(JSON.stringify({ data: { employee } }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})) as unknown as typeof fetch;
}

function createMockRepo(
	payslip: unknown = { minioObjectKey: "payslips/emp-1/2026/1.pdf" },
) {
	const repo = {
		async findByEmployeeAndPeriod() {
			return payslip;
		},
	};
	return repo as unknown as PayslipRepository;
}

function createMockMinio(
	presignImpl: () => Promise<string> = async () =>
		"https://minio.local/presigned",
) {
	return { presignedGetObject: presignImpl } as unknown as Client;
}

test("INT-9-1: valid request returns a presigned URL with correct expiry", async () => {
	stubEmployeeFetch();
	const useCase = new GetPayslipURLUseCase({
		payslipRepository: createMockRepo(),
		minio: createMockMinio(),
	});

	const result = (await useCase.execute({
		input: { employeeId: "emp-1", month: 1, year: 2026 },
	})) as {
		url: string;
		expiresAt: Date;
	};

	expect(result.url).toBe("https://minio.local/presigned");
	expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
});

test("INT-9-2: non-existent payslip returns not found error", async () => {
	stubEmployeeFetch();
	const useCase = new GetPayslipURLUseCase({
		payslipRepository: createMockRepo(null),
		minio: createMockMinio(),
	});

	await expect(
		useCase.execute({ input: { employeeId: "emp-1", month: 1, year: 2026 } }),
	).rejects.toMatchObject({
		extensions: { code: "NOT_FOUND" },
	});
});

test("INT-9-3: Minio presign failure returns internal error", async () => {
	stubEmployeeFetch();
	const useCase = new GetPayslipURLUseCase({
		payslipRepository: createMockRepo(),
		minio: createMockMinio(async () => {
			throw new Error("minio unreachable");
		}),
	});

	await expect(
		useCase.execute({ input: { employeeId: "emp-1", month: 1, year: 2026 } }),
	).rejects.toBeInstanceOf(GraphQLError);
});

// Edge case: employeeId does not exist — return not found error
test("non-existent employeeId returns not found error", async () => {
	stubEmployeeFetch(null);
	const useCase = new GetPayslipURLUseCase({
		payslipRepository: createMockRepo(),
		minio: createMockMinio(),
	});

	await expect(
		useCase.execute({ input: { employeeId: "missing", month: 1, year: 2026 } }),
	).rejects.toMatchObject({
		extensions: { code: "NOT_FOUND" },
	});
});
