import { GraphQLError } from "graphql";
import type { Client } from "minio";
import { BaseUseCase } from "server";
import EmployeeServiceClient from "../clients/EmployeeServiceClient";
import type PayslipRepository from "../repositories/PayslipRepository";

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
export default class GetPayslipURLUseCase extends BaseUseCase<
	{ input: GetPayslipURLInput },
	unknown
> {
	private readonly payslipRepository: PayslipRepository;
	private readonly employeeServiceClient: EmployeeServiceClient;
	private readonly minio: Client;

	// EmployeeServiceClient is constructed internally (not container-injected) — same convention
	// as GeneratePayslipsUseCase. It has no DI dependencies of its own; registering it via
	// awilix's asClass()/singleton() would call `new EmployeeServiceClient(cradle)`, passing the
	// cradle proxy itself as the constructor's first positional arg since it doesn't destructure.
	constructor({
		payslipRepository,
		minio,
	}: { payslipRepository: PayslipRepository; minio: Client }) {
		super();
		this.payslipRepository = payslipRepository;
		this.employeeServiceClient = new EmployeeServiceClient();
		this.minio = minio;
	}

	async execute({ input }: { input: GetPayslipURLInput }) {
		const employee = await this.employeeServiceClient.findEmployee(
			input.employeeId,
		);
		if (!employee) {
			throw new GraphQLError("employeeId does not exist", {
				extensions: { code: "NOT_FOUND" },
			});
		}

		const payslip = await this.payslipRepository.findByEmployeeAndPeriod(
			input.employeeId,
			input.month,
			input.year,
		);
		if (!payslip) {
			throw new GraphQLError(
				"payslip not found for the given employeeId/month/year",
				{
					extensions: { code: "NOT_FOUND" },
				},
			);
		}

		let url: string;
		try {
			url = await this.minio.presignedGetObject(
				PAYSLIPS_BUCKET,
				payslip.minioObjectKey,
				URL_EXPIRY_SECONDS,
			);
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
