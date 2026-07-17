import type { EmployeeEmployeeProto } from "api";
import { BaseUseCase } from "server";
import RequestPasswordResetUseCase from "./RequestPasswordResetUseCase";

type RequestPasswordResetRequest = EmployeeEmployeeProto.RequestPasswordResetRequest;
type AcknowledgementResponse = EmployeeEmployeeProto.AcknowledgementResponse;

/** gRPC adapter over RequestPasswordResetUseCase — see RegisterEmployeeGrpcUseCase. */
export default class RequestPasswordResetGrpcUseCase extends BaseUseCase<
	RequestPasswordResetRequest,
	AcknowledgementResponse
> {
	private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase;

	constructor({ requestPasswordResetUseCase }: { requestPasswordResetUseCase: RequestPasswordResetUseCase }) {
		super();
		this.requestPasswordResetUseCase = requestPasswordResetUseCase;
	}

	async execute(request: RequestPasswordResetRequest): Promise<AcknowledgementResponse> {
		const result = await this.requestPasswordResetUseCase.execute({ input: { email: request.email } });
		return {
			$type: "employee.AcknowledgementResponse",
			success: result.success,
			message: result.message ?? "",
		};
	}
}
