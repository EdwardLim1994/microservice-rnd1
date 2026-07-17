import type { Client } from "minio";
import { BaseUseCase } from "server";
import PayslipRepository from "../repositories/PayslipRepository";

interface StorePayslipInput {
	employeeId: string;
	month: number;
	year: number;
	pdfBytes: Uint8Array;
}

const PAYSLIPS_BUCKET = "payslips";

/**
 * FEAT-4 — standalone component (payroll-subgraph.PayrollService.StorePayslip), not folded into
 * FEAT-3. GeneratePayslipsUseCase calls this in-process for each employee rather than
 * duplicating the Minio/Postgres logic.
 */
export default class StorePayslipUseCase extends BaseUseCase<
	{ input: StorePayslipInput },
	unknown
> {
	private readonly payslipRepository: PayslipRepository;
	private readonly minio: Client;

	constructor({
		payslipRepository,
		minio,
	}: {
		payslipRepository: PayslipRepository;
		minio: Client;
	}) {
		super();
		this.payslipRepository = payslipRepository;
		this.minio = minio;
	}

	async execute({ input }: { input: StorePayslipInput }) {
		if (input.pdfBytes.length === 0) {
			throw new Error("pdfBytes must not be empty");
		}

		const minioObjectKey = `${PAYSLIPS_BUCKET}/${input.employeeId}/${input.year}/${input.month}.pdf`;

		if (!(await this.minio.bucketExists(PAYSLIPS_BUCKET))) {
			await this.minio.makeBucket(PAYSLIPS_BUCKET);
		}

		try {
			await this.minio.putObject(PAYSLIPS_BUCKET, minioObjectKey, Buffer.from(input.pdfBytes));
		} catch (error) {
			// Edge case: Minio upload failure — return error, do not persist to Postgres.
			throw new Error("failed to upload payslip PDF to Minio", { cause: error });
		}

		return this.payslipRepository.upsert({
			employeeId: input.employeeId,
			month: input.month,
			year: input.year,
			minioObjectKey,
		});
	}
}
