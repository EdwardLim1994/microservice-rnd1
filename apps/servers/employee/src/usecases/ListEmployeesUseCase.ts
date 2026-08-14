import type {
  ListEmployeesRequest,
  ListEmployeesResponse,
} from 'api/src/generated/employee/proto/employee';
import { BaseUseCase } from 'server';
import type { EmployeeRepository } from '../repositories/EmployeeRepository';
import { toProto } from './helpers';

export class ListEmployeesUseCase extends BaseUseCase<
  ListEmployeesRequest,
  ListEmployeesResponse
> {
  constructor(
    private readonly deps: { employeeRepository: EmployeeRepository },
  ) {
    super();
  }

  async execute(req: ListEmployeesRequest): Promise<ListEmployeesResponse> {
    const page = req.page ?? 1;
    const pageSize = req.pageSize ?? 20;
    const { employees, total } = await this.deps.employeeRepository.findAll(
      page,
      pageSize,
    );
    return {
      $type: 'employee.ListEmployeesResponse',
      employees: employees.map(toProto),
      total,
    };
  }
}
