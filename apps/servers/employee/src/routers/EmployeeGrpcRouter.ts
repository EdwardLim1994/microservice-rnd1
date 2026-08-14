import {
  type EmployeeServiceServer,
  EmployeeServiceService,
} from 'api/src/generated/employee/proto/employee';
import { GrpcRouter } from 'server';
import { GetEmployeeRateUseCase } from '../usecases/GetEmployeeRateUseCase';
import { GetEmployeeUseCase } from '../usecases/GetEmployeeUseCase';
import { GetSupervisorChainUseCase } from '../usecases/GetSupervisorChainUseCase';
import { ListEmployeesUseCase } from '../usecases/ListEmployeesUseCase';
import { RegisterEmployeeUseCase } from '../usecases/RegisterEmployeeUseCase';
import { UpdateEmployeeUseCase } from '../usecases/UpdateEmployeeUseCase';

export class EmployeeGrpcRouter extends GrpcRouter<EmployeeServiceServer> {
  get service() {
    return EmployeeServiceService;
  }

  get handlers() {
    return {
      registerEmployee: RegisterEmployeeUseCase,
      updateEmployee: UpdateEmployeeUseCase,
      getEmployee: GetEmployeeUseCase,
      listEmployees: ListEmployeesUseCase,
      getSupervisorChain: GetSupervisorChainUseCase,
      getEmployeeRate: GetEmployeeRateUseCase,
    };
  }
}
