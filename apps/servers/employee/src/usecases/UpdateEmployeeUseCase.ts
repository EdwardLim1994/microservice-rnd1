import type {
  UpdateEmployeeRequest,
  UpdateEmployeeResponse,
} from 'api/src/generated/employee/proto/employee';
import { BaseUseCase } from 'server';
import type { EmployeeRepository } from '../repositories/EmployeeRepository';
import { grpcNotFound, toProto } from './helpers';

export class UpdateEmployeeUseCase extends BaseUseCase<
  UpdateEmployeeRequest,
  UpdateEmployeeResponse
> {
  constructor(
    private readonly deps: { employeeRepository: EmployeeRepository },
  ) {
    super();
  }

  async execute(req: UpdateEmployeeRequest): Promise<UpdateEmployeeResponse> {
    const existing = await this.deps.employeeRepository.findById(req.id);
    if (!existing) throw grpcNotFound(req.id);

    const row = await this.deps.employeeRepository.update(req.id, {
      monthlyRate: req.monthlyRate,
      supervisorId: req.supervisorId ?? null,
    });
    return {
      $type: 'employee.UpdateEmployeeResponse',
      employee: toProto(row),
    };
  }
}
