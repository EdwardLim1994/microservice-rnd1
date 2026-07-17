import { PayrollPayrollProto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "server";
import GeneratePayslipsGrpcUseCase from "../usecases/GeneratePayslipsGrpcUseCase";
import StorePayslipGrpcUseCase from "../usecases/StorePayslipGrpcUseCase";

export default class PayrollGrpcRouter extends GrpcRouter<PayrollPayrollProto.PayrollServiceServer> {
	get service() {
		return PayrollPayrollProto.PayrollServiceService;
	}

	get handlers(): GrpcHandlerMap<PayrollPayrollProto.PayrollServiceServer> {
		return {
			generatePayslips: GeneratePayslipsGrpcUseCase,
			storePayslip: StorePayslipGrpcUseCase,
		};
	}
}
