import type { EmployeeEmployeeProto } from "api";
import { BaseUseCase } from "server";
import ConfirmPasswordResetUseCase from "./ConfirmPasswordResetUseCase";

type ConfirmPasswordResetRequest = EmployeeEmployeeProto.ConfirmPasswordResetRequest;
type AcknowledgementResponse = EmployeeEmployeeProto.AcknowledgementResponse;

/** gRPC adapter over ConfirmPasswordResetUseCase — see RegisterEmployeeGrpcUseCase. */
export default class ConfirmPasswordResetGrpcUseCase extends BaseUseCase<
	ConfirmPasswordResetRequest,
	AcknowledgementResponse
> {
	private readonly confirmPasswordResetUseCase: ConfirmPasswordResetUseCase;

	constructor({ confirmPasswordResetUseCase }: { confirmPasswordResetUseCase: ConfirmPasswordResetUseCase }) {
		super();
		this.confirmPasswordResetUseCase = confirmPasswordResetUseCase;
	}

	async execute(request: ConfirmPasswordResetRequest): Promise<AcknowledgementResponse> {
		const result = await this.confirmPasswordResetUseCase.execute({
			input: { resetToken: request.resetToken, newPassword: request.newPassword },
		});
		return {
			$type: "employee.AcknowledgementResponse",
			success: result.success,
			message: result.message ?? "",
		};
	}
}
