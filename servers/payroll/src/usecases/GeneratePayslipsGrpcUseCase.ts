import type { PayrollPayrollProto } from "api";
import { BaseUseCase } from "server";
import type GeneratePayslipsUseCase from "./GeneratePayslipsUseCase";

type GeneratePayslipsRequest = PayrollPayrollProto.GeneratePayslipsRequest;
type GeneratePayslipsResponse = PayrollPayrollProto.GeneratePayslipsResponse;

/** gRPC adapter over GeneratePayslipsUseCase — see employee server's RegisterEmployeeGrpcUseCase. */
export default class GeneratePayslipsGrpcUseCase extends BaseUseCase<
	GeneratePayslipsRequest,
	GeneratePayslipsResponse
> {
	private readonly generatePayslipsUseCase: GeneratePayslipsUseCase;

	constructor({
		generatePayslipsUseCase,
	}: { generatePayslipsUseCase: GeneratePayslipsUseCase }) {
		super();
		this.generatePayslipsUseCase = generatePayslipsUseCase;
	}

	async execute(
		request: GeneratePayslipsRequest,
	): Promise<GeneratePayslipsResponse> {
		const result = (await this.generatePayslipsUseCase.execute({
			input: { month: request.month, year: request.year },
		})) as {
			generated: {
				id: string;
				employeeId: string;
				month: number;
				year: number;
				minioObjectKey: string;
				generatedAt: Date;
			}[];
			failed: string[];
		};

		return {
			$type: "payroll.GeneratePayslipsResponse",
			generated: result.generated.map((payslip) => ({
				$type: "payroll.Payslip" as const,
				id: payslip.id,
				employeeId: payslip.employeeId,
				month: payslip.month,
				year: payslip.year,
				minioObjectKey: payslip.minioObjectKey,
				generatedAt: payslip.generatedAt.toISOString(),
			})),
			failed: result.failed,
		};
	}
}
