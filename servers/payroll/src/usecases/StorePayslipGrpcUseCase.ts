import type { PayrollPayrollProto } from "api";
import { BaseUseCase } from "server";
import StorePayslipUseCase from "./StorePayslipUseCase";

type StorePayslipRequest = PayrollPayrollProto.StorePayslipRequest;
type Payslip = PayrollPayrollProto.Payslip;

/** gRPC adapter over StorePayslipUseCase — see employee server's RegisterEmployeeGrpcUseCase. */
export default class StorePayslipGrpcUseCase extends BaseUseCase<StorePayslipRequest, Payslip> {
	private readonly storePayslipUseCase: StorePayslipUseCase;

	constructor({ storePayslipUseCase }: { storePayslipUseCase: StorePayslipUseCase }) {
		super();
		this.storePayslipUseCase = storePayslipUseCase;
	}

	async execute(request: StorePayslipRequest): Promise<Payslip> {
		const result = (await this.storePayslipUseCase.execute({
			input: {
				employeeId: request.employeeId,
				month: request.month,
				year: request.year,
				pdfBytes: request.pdfBytes,
			},
		})) as {
			id: string;
			employeeId: string;
			month: number;
			year: number;
			minioObjectKey: string;
			generatedAt: Date;
		};

		return {
			$type: "payroll.Payslip",
			id: result.id,
			employeeId: result.employeeId,
			month: result.month,
			year: result.year,
			minioObjectKey: result.minioObjectKey,
			generatedAt: result.generatedAt.toISOString(),
		};
	}
}
