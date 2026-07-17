import { expect, test } from "@rstest/core";
import type { Client } from "minio";
import StorePayslipUseCase from "../../src/usecases/StorePayslipUseCase";
import type PayslipRepository from "../../src/repositories/PayslipRepository";

function createMockMinio(options: { putObjectThrows?: boolean } = {}) {
	const uploaded: { bucket: string; key: string }[] = [];
	const minio = {
		async bucketExists() {
			return true;
		},
		async makeBucket() {},
		async putObject(bucket: string, key: string) {
			if (options.putObjectThrows) throw new Error("minio down");
			uploaded.push({ bucket, key });
		},
	};
	return { minio: minio as unknown as Client, uploaded: () => uploaded };
}

function createMockPayslipRepository() {
	const upserted: Record<string, unknown>[] = [];
	const repo = {
		async upsert(data: Record<string, unknown>) {
			const payslip = { id: `payslip-${upserted.length + 1}`, ...data };
			upserted.push(payslip);
			return payslip;
		},
	};
	return { payslipRepository: repo as unknown as PayslipRepository, upserted: () => upserted };
}

function validInput(overrides: Record<string, unknown> = {}) {
	return {
		employeeId: "emp-1",
		month: 1,
		year: 2026,
		pdfBytes: new Uint8Array([1, 2, 3]),
		...overrides,
	};
}

// [INT-4-1] Valid PDF uploads to Minio and persists record to Postgres
test("uploads the PDF to Minio and persists the record", async () => {
	const { minio, uploaded } = createMockMinio();
	const { payslipRepository, upserted } = createMockPayslipRepository();
	const useCase = new StorePayslipUseCase({ payslipRepository, minio });

	const result = (await useCase.execute({ input: validInput() })) as { minioObjectKey: string };

	expect(uploaded()).toHaveLength(1);
	expect(upserted()).toHaveLength(1);
	expect(result.minioObjectKey).toBe("payslips/emp-1/2026/1.pdf");
});

// [INT-4-2] Minio failure does not persist record to Postgres
test("does not persist to Postgres when the Minio upload fails", async () => {
	const { minio } = createMockMinio({ putObjectThrows: true });
	const { payslipRepository, upserted } = createMockPayslipRepository();
	const useCase = new StorePayslipUseCase({ payslipRepository, minio });

	let thrown: unknown;
	try {
		await useCase.execute({ input: validInput() });
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(Error);
	expect(upserted()).toHaveLength(0);
});

// [INT-4-3] Duplicate payslip overwrites existing object and updates record
test("upserts (overwrites) on a duplicate employeeId/month/year", async () => {
	const { minio } = createMockMinio();
	const { payslipRepository, upserted } = createMockPayslipRepository();
	const useCase = new StorePayslipUseCase({ payslipRepository, minio });

	await useCase.execute({ input: validInput() });
	await useCase.execute({ input: validInput() });

	// upsert() is called twice — repository owns the actual overwrite-vs-insert behavior
	// (tested at the repository layer); this confirms the use case doesn't try to guard
	// against a duplicate itself.
	expect(upserted()).toHaveLength(2);
});

// Edge case: pdfBytes empty
test("empty pdfBytes throws a validation error", async () => {
	const { minio, uploaded } = createMockMinio();
	const { payslipRepository } = createMockPayslipRepository();
	const useCase = new StorePayslipUseCase({ payslipRepository, minio });

	let thrown: unknown;
	try {
		await useCase.execute({ input: validInput({ pdfBytes: new Uint8Array() }) });
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(Error);
	expect(uploaded()).toHaveLength(0);
});
