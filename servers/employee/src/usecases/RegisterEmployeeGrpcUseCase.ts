import type { EmployeeEmployeeProto } from "api";
import { BaseUseCase } from "server";
import type RegisterEmployeeSaga from "./RegisterEmployeeSaga";

type RegisterEmployeeRequest = EmployeeEmployeeProto.RegisterEmployeeRequest;
type RegisterEmployeeResponse = EmployeeEmployeeProto.RegisterEmployeeResponse;

// Thin gRPC adapter over RegisterEmployeeSaga — decodes/encodes the protobuf shape, delegates all
// business logic (create Employee, create Authentik account, roll back on failure) to the same
// saga the GraphQL resolver uses, so the two protocols never diverge in behaviour. Injected via
// normal awilix PROXY mode (token `registerEmployeeSaga`, auto-registered by EmployeeGraphqlRouter
// the same way any use case is) rather than manually constructed from a raw container reference.
export default class RegisterEmployeeGrpcUseCase extends BaseUseCase<
	RegisterEmployeeRequest,
	RegisterEmployeeResponse
> {
	private readonly registerEmployeeSaga: RegisterEmployeeSaga;

	constructor({ registerEmployeeSaga }: { registerEmployeeSaga: RegisterEmployeeSaga }) {
		super();
		this.registerEmployeeSaga = registerEmployeeSaga;
	}

	async execute(request: RegisterEmployeeRequest): Promise<RegisterEmployeeResponse> {
		const result = await this.registerEmployeeSaga.execute({
			firstName: request.firstName,
			lastName: request.lastName,
			gender: request.gender,
			email: request.email,
			grossSalary: request.grossSalary,
			salaryPerDay: request.salaryPerDay,
			supervisorId: request.supervisorId,
		});

		const employee = result.employee;
		if (!employee) {
			throw new Error("RegisterEmployeeSaga completed without producing an employee record");
		}

		return {
			$type: "employee.RegisterEmployeeResponse",
			employee: {
				$type: "employee.Employee",
				id: employee.id,
				firstName: employee.firstName,
				lastName: employee.lastName,
				gender: employee.gender,
				email: employee.email,
				grossSalary: employee.grossSalary,
				salaryPerDay: employee.salaryPerDay,
				supervisorId: employee.supervisorId ?? undefined,
				createdAt: employee.createdAt.toISOString(),
				updatedAt: employee.updatedAt.toISOString(),
			},
			temporaryPassword: result.temporaryPassword ?? "",
		};
	}
}
