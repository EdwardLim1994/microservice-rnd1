import type {
  GetSupervisorChainRequest,
  GetSupervisorChainResponse,
} from 'api/src/generated/employee/proto/employee';
import { BaseUseCase } from 'server';
import type { EmployeeRepository } from '../repositories/EmployeeRepository';
import { grpcNotFound, toProto } from './helpers';

export class GetSupervisorChainUseCase extends BaseUseCase<
  GetSupervisorChainRequest,
  GetSupervisorChainResponse
> {
  constructor(
    private readonly deps: { employeeRepository: EmployeeRepository },
  ) {
    super();
  }

  async execute(
    req: GetSupervisorChainRequest,
  ): Promise<GetSupervisorChainResponse> {
    const employee = await this.deps.employeeRepository.findById(
      req.employeeId,
    );
    if (!employee) throw grpcNotFound(req.employeeId);
    const chain = await this.deps.employeeRepository.getSupervisorChain(
      req.employeeId,
    );
    return {
      $type: 'employee.GetSupervisorChainResponse',
      chain: chain.map(toProto),
    };
  }
}
