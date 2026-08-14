import type {
	GetPayrollRecordsRequest,
	GetPayrollRecordsResponse,
} from "api/src/generated/payroll/proto/payroll";
import { BaseUseCase } from "server";
import type { PayrollRepository } from "../repositories/PayrollRepository";
import { toProto } from "./helpers";

export class GetPayrollRecordsUseCase extends BaseUseCase<
	GetPayrollRecordsRequest,
	GetPayrollRecordsResponse
> {
	constructor(private readonly deps: { payrollRepository: PayrollRepository }) {
		super();
	}

	async execute(
		req: GetPayrollRecordsRequest,
	): Promise<GetPayrollRecordsResponse> {
		const { records, total } = await this.deps.payrollRepository.findByEmployee(
			req.employeeId,
			req.year,
			req.page ?? 1,
			req.pageSize ?? 20,
		);
		return {
			$type: "payroll.GetPayrollRecordsResponse",
			records: records.map(toProto),
			total,
		};
	}
}
