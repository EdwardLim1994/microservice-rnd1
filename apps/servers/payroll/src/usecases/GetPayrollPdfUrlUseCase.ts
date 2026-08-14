import type {
  GetPayrollPdfUrlRequest,
  GetPayrollPdfUrlResponse,
} from 'api/src/generated/payroll/proto/payroll';
import type { Client as MinioClient } from 'minio';
import { BaseUseCase } from 'server';
import type { PayrollRepository } from '../repositories/PayrollRepository';
import { grpcNotFound, grpcPermissionDenied } from './helpers';

const PAYROLL_BUCKET = 'payroll';
const URL_EXPIRY_SECONDS = 900; // 15 minutes

export class GetPayrollPdfUrlUseCase extends BaseUseCase<
  GetPayrollPdfUrlRequest,
  GetPayrollPdfUrlResponse
> {
  constructor(
    private readonly deps: {
      payrollRepository: PayrollRepository;
      minio: MinioClient;
    },
  ) {
    super();
  }

  async execute(
    req: GetPayrollPdfUrlRequest,
  ): Promise<GetPayrollPdfUrlResponse> {
    const record = await this.deps.payrollRepository.findById(
      req.payrollRecordId,
    );
    if (!record) throw grpcNotFound(req.payrollRecordId);

    // Access control: own record only — HR Admin enforcement is at the GraphQL subgraph layer
    if (record.employeeId !== req.requestorId)
      throw grpcPermissionDenied('Access denied: not your payroll record');

    const url = await this.deps.minio.presignedGetObject(
      PAYROLL_BUCKET,
      record.pdfKey,
      URL_EXPIRY_SECONDS,
    );
    return { $type: 'payroll.GetPayrollPdfUrlResponse', url };
  }
}
