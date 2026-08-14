import type {
  GetEmployeeRateRequest,
  GetEmployeeRateResponse,
} from 'api/src/generated/employee/proto/employee';
import { BaseUseCase } from 'server';
import type { EmployeeRepository } from '../repositories/EmployeeRepository';
import { grpcNotFound } from './helpers';

export class GetEmployeeRateUseCase extends BaseUseCase<
  GetEmployeeRateRequest,
  GetEmployeeRateResponse
> {
  constructor(
    private readonly deps: { employeeRepository: EmployeeRepository },
  ) {
    super();
  }

  async execute(req: GetEmployeeRateRequest): Promise<GetEmployeeRateResponse> {
    const row = await this.deps.employeeRepository.findById(req.employeeId);
    if (!row) throw grpcNotFound(req.employeeId);
    return {
      $type: 'employee.GetEmployeeRateResponse',
      employeeId: row.id,
      monthlyRate: row.monthlyRate,
    };
  }
}
