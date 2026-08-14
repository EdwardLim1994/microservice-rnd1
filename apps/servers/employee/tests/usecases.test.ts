import { expect, mock, test } from 'bun:test';
import { GetEmployeeRateUseCase } from '../src/usecases/GetEmployeeRateUseCase';
import { GetEmployeeUseCase } from '../src/usecases/GetEmployeeUseCase';
import { GetSupervisorChainUseCase } from '../src/usecases/GetSupervisorChainUseCase';
import { ListEmployeesUseCase } from '../src/usecases/ListEmployeesUseCase';
import { RegisterEmployeeUseCase } from '../src/usecases/RegisterEmployeeUseCase';
import { UpdateEmployeeUseCase } from '../src/usecases/UpdateEmployeeUseCase';

const now = new Date();
const row = (id = 'e1') => ({
  id,
  fullName: 'Alice',
  personalEmail: 'alice@example.com',
  monthlyRate: 5000,
  supervisorId: null,
  createdAt: now,
  updatedAt: now,
});

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    create: mock(async () => row()),
    update: mock(async () => row()),
    findById: mock(async (id: string) => row(id)),
    findAll: mock(async () => ({ employees: [row()], total: 1 })),
    getSupervisorChain: mock(async () => [row('mgr1')]),
    ...overrides,
  };
}

test('RegisterEmployeeUseCase — creates and returns employee with password', async () => {
  const repo = makeRepo();
  const uc = new RegisterEmployeeUseCase({ employeeRepository: repo as never });
  const res = await uc.execute({
    $type: 'employee.RegisterEmployeeRequest',
    fullName: 'Alice',
    personalEmail: 'alice@example.com',
    monthlyRate: 5000,
    supervisorId: undefined,
  });
  expect(repo.create).toHaveBeenCalled();
  expect(res.generatedPassword).toBeString();
  expect(res.generatedPassword.length).toBeGreaterThan(0);
});

test('GetEmployeeUseCase — returns found employee', async () => {
  const repo = makeRepo();
  const uc = new GetEmployeeUseCase({ employeeRepository: repo as never });
  const res = await uc.execute({
    $type: 'employee.GetEmployeeRequest',
    id: 'e1',
  });
  expect(repo.findById).toHaveBeenCalledWith('e1');
  expect(res.id).toBe('e1');
});

test('GetEmployeeUseCase — throws NOT_FOUND when missing', async () => {
  const repo = makeRepo({ findById: mock(async () => null) });
  const uc = new GetEmployeeUseCase({ employeeRepository: repo as never });
  await expect(
    uc.execute({ $type: 'employee.GetEmployeeRequest', id: 'x' }),
  ).rejects.toMatchObject({ code: 5 });
});

test('ListEmployeesUseCase — delegates pagination', async () => {
  const repo = makeRepo();
  const uc = new ListEmployeesUseCase({ employeeRepository: repo as never });
  const res = await uc.execute({
    $type: 'employee.ListEmployeesRequest',
    page: 1,
    pageSize: 10,
  });
  expect(repo.findAll).toHaveBeenCalledWith(1, 10);
  expect(res.total).toBe(1);
});

test('GetSupervisorChainUseCase — returns chain', async () => {
  const repo = makeRepo();
  const uc = new GetSupervisorChainUseCase({
    employeeRepository: repo as never,
  });
  const res = await uc.execute({
    $type: 'employee.GetSupervisorChainRequest',
    employeeId: 'e1',
  });
  expect(repo.getSupervisorChain).toHaveBeenCalledWith('e1');
  expect(res.chain.length).toBe(1);
});

test('GetEmployeeRateUseCase — returns monthlyRate', async () => {
  const repo = makeRepo();
  const uc = new GetEmployeeRateUseCase({ employeeRepository: repo as never });
  const res = await uc.execute({
    $type: 'employee.GetEmployeeRateRequest',
    employeeId: 'e1',
  });
  expect(res.monthlyRate).toBe(5000);
});

test('UpdateEmployeeUseCase — updates and returns employee', async () => {
  const repo = makeRepo();
  const uc = new UpdateEmployeeUseCase({ employeeRepository: repo as never });
  const res = await uc.execute({
    $type: 'employee.UpdateEmployeeRequest',
    id: 'e1',
    fullName: 'Bob',
    monthlyRate: 6000,
    supervisorId: undefined,
  });
  expect(repo.update).toHaveBeenCalled();
  expect(res.employee?.id).toBe('e1');
});
