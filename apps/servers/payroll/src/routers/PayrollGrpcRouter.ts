import type { PayrollServiceServer } from 'api/src/generated/payroll/proto/payroll';
import { PayrollServiceService } from 'api/src/generated/payroll/proto/payroll';
import { GrpcRouter } from 'server';
import { GetPayrollPdfUrlUseCase } from '../usecases/GetPayrollPdfUrlUseCase';
import { GetPayrollRecordsUseCase } from '../usecases/GetPayrollRecordsUseCase';

export class PayrollGrpcRouter extends GrpcRouter<PayrollServiceServer> {
  get service() {
    return PayrollServiceService;
  }

  get handlers() {
    return {
      getPayrollRecords: GetPayrollRecordsUseCase,
      getPayrollPdfUrl: GetPayrollPdfUrlUseCase,
    };
  }
}
