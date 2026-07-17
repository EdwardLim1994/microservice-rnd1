import { GraphQLError } from "graphql";
import type { Client } from "minio";
import { BaseUseCase } from "server";
import PayslipRepository from "../repositories/PayslipRepository";

export interface GetPayslipURLInput {
	employeeId: string;
	month: number;
	year: number;
}

const PAYSLIPS_BUCKET = "payslips";
const URL_EXPIRY_SECONDS = 15 * 60;

/**
 * FEAT-9 — payroll-subgraph.PayrollService.GetPayslipURL. Generates a short-lived presigned
 * Minio URL for an existing payslip PDF.
 */
export default class GetPayslipURLUseCase extends BaseUseCase<{ input: GetPayslipURLInput }, unknown> {
	private readonly payslipRepository: PayslipRepository;
	private readonly minio: Client;

	constructor({ payslipRepository, minio }: { payslipRepository: PayslipRepository; minio: Client }) {
		super();
		this.payslipRepository = payslipRepository;
		this.minio = minio;
	}

	async execute({ input }: { input: GetPayslipURLInput }) {
		const payslip = await this.payslipRepository.findByEmployeeAndPeriod(input.employeeId, input.month, input.year);
		if (!payslip) {
			throw new GraphQLError("no payslip found for the given employeeId/month/year", {
				extensions: { code: "NOT_FOUND" },
			});
		}

		let url: string;
		try {
			url = await this.minio.presignedGetObject(PAYSLIPS_BUCKET, payslip.minioObjectKey, URL_EXPIRY_SECONDS);
		} catch (error) {
			throw new GraphQLError("failed to generate presigned payslip URL", {
				extensions: { code: "INTERNAL_ERROR" },
				originalError: error instanceof Error ? error : undefined,
			});
		}

		return {
			url,
			expiresAt: new Date(Date.now() + URL_EXPIRY_SECONDS * 1000),
		};
	}
}
