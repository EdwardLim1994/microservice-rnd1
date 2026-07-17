import type { PayrollPayrollProto } from "api";
import { BaseUseCase } from "server";
import type GetPayslipURLUseCase from "./GetPayslipURLUseCase";

type GetPayslipURLRequest = PayrollPayrollProto.GetPayslipURLRequest;
type PayslipDownloadURLMessage = PayrollPayrollProto.PayslipDownloadURL;

/** gRPC adapter over GetPayslipURLUseCase — see employee server's RegisterEmployeeGrpcUseCase. */
export default class GetPayslipURLGrpcUseCase extends BaseUseCase<
	GetPayslipURLRequest,
	PayslipDownloadURLMessage
> {
	private readonly getPayslipURLUseCase: GetPayslipURLUseCase;

	constructor({
		getPayslipURLUseCase,
	}: { getPayslipURLUseCase: GetPayslipURLUseCase }) {
		super();
		this.getPayslipURLUseCase = getPayslipURLUseCase;
	}

	async execute(
		request: GetPayslipURLRequest,
	): Promise<PayslipDownloadURLMessage> {
		const result = (await this.getPayslipURLUseCase.execute({
			input: {
				employeeId: request.employeeId,
				month: request.month,
				year: request.year,
			},
		})) as { url: string; expiresAt: Date };

		return {
			$type: "payroll.PayslipDownloadURL",
			url: result.url,
			expiresAt: result.expiresAt.toISOString(),
		};
	}
}
