import type { EmployeeEmployeeProto } from "api";
import { BaseUseCase } from "server";
import RegisterEmployeeUseCase from "./RegisterEmployeeUseCase";

type RegisterEmployeeRequest = EmployeeEmployeeProto.RegisterEmployeeRequest;
type RegisterEmployeeResponse = EmployeeEmployeeProto.RegisterEmployeeResponse;

/**
 * gRPC adapter over RegisterEmployeeUseCase (FEAT-1's spec names this a gRPC endpoint —
 * employee-subgraph.EmployeeService.RegisterEmployee). Delegates the actual business logic to
 * the same use case the GraphQL mutation uses, only reshaping the proto's flatter wire format
 * (supervisorId as an empty-string sentinel, createdAt as an ISO string) to/from the domain
 * use case's GraphQL-oriented shape (nullable supervisorId, Date).
 */
export default class RegisterEmployeeGrpcUseCase extends BaseUseCase<
	RegisterEmployeeRequest,
	RegisterEmployeeResponse
> {
	private readonly registerEmployeeUseCase: RegisterEmployeeUseCase;

	constructor({ registerEmployeeUseCase }: { registerEmployeeUseCase: RegisterEmployeeUseCase }) {
		super();
		this.registerEmployeeUseCase = registerEmployeeUseCase;
	}

	async execute(request: RegisterEmployeeRequest): Promise<RegisterEmployeeResponse> {
		const result = await this.registerEmployeeUseCase.execute({
			input: {
				fullName: request.fullName,
				employeeId: request.employeeId,
				role: request.role,
				department: request.department,
				grossSalary: request.grossSalary,
				supervisorId: request.supervisorId || null,
			},
		});

		const supervisor = result.employee.supervisor as { id: string } | null;
		return {
			$type: "employee.RegisterEmployeeResponse",
			employee: {
				$type: "employee.Employee",
				id: result.employee.id,
				employeeId: result.employee.employeeId,
				fullName: result.employee.fullName,
				role: result.employee.role,
				department: result.employee.department,
				grossSalary: result.employee.grossSalary,
				supervisorId: supervisor?.id ?? "",
				createdAt: result.employee.createdAt.toISOString(),
			},
			temporaryPassword: result.temporaryPassword,
		};
	}
}
