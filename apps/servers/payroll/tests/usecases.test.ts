import { expect, mock, test } from 'bun:test';
import { GetPayrollPdfUrlUseCase } from '../src/usecases/GetPayrollPdfUrlUseCase';
import { GetPayrollRecordsUseCase } from '../src/usecases/GetPayrollRecordsUseCase';
import { buildPayslipText } from '../src/usecases/helpers';

const now = new Date();
const row = (id = 'pr1') => ({
  id,
  employeeId: 'e1',
  year: 2026,
  month: 1,
  monthlyRate: 5000,
  unpaidDays: 0,
  dailyRate: 166.67,
  deduction: 0,
  netAmount: 5000,
  pdfKey: 'e1/2026/1.pdf',
  generatedAt: now,
});

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    findByEmployee: mock(async () => ({ records: [row()], total: 1 })),
    findById: mock(async (id: string) => row(id)),
    upsert: mock(async () => row()),
    ...overrides,
  };
}

test('GetPayrollRecordsUseCase — returns records with pagination', async () => {
  const repo = makeRepo();
  const uc = new GetPayrollRecordsUseCase({ payrollRepository: repo as never });
  const res = await uc.execute({
    $type: 'payroll.GetPayrollRecordsRequest',
    employeeId: 'e1',
    year: 2026,
    page: 1,
    pageSize: 20,
  });
  expect(repo.findByEmployee).toHaveBeenCalledWith('e1', 2026, 1, 20);
  expect(res.total).toBe(1);
  expect(res.records.length).toBe(1);
});

test('GetPayrollRecordsUseCase — defaults page and pageSize', async () => {
  const repo = makeRepo();
  const uc = new GetPayrollRecordsUseCase({ payrollRepository: repo as never });
  await uc.execute({
    $type: 'payroll.GetPayrollRecordsRequest',
    employeeId: 'e1',
    year: 2026,
  });
  expect(repo.findByEmployee).toHaveBeenCalledWith('e1', 2026, 1, 20);
});

test('GetPayrollPdfUrlUseCase — returns presigned URL for own record', async () => {
  const repo = makeRepo();
  const minio = { presignedGetObject: mock(async () => 'https://s3/url') };
  const uc = new GetPayrollPdfUrlUseCase({
    payrollRepository: repo as never,
    minio: minio as never,
  });
  const res = await uc.execute({
    $type: 'payroll.GetPayrollPdfUrlRequest',
    payrollRecordId: 'pr1',
    requestorId: 'e1',
  });
  expect(minio.presignedGetObject).toHaveBeenCalledWith(
    'payroll',
    'e1/2026/1.pdf',
    900,
  );
  expect(res.url).toBe('https://s3/url');
});

test('GetPayrollPdfUrlUseCase — throws NOT_FOUND when missing', async () => {
  const repo = makeRepo({ findById: mock(async () => null) });
  const minio = { presignedGetObject: mock(async () => '') };
  const uc = new GetPayrollPdfUrlUseCase({
    payrollRepository: repo as never,
    minio: minio as never,
  });
  await expect(
    uc.execute({
      $type: 'payroll.GetPayrollPdfUrlRequest',
      payrollRecordId: 'x',
      requestorId: 'e1',
    }),
  ).rejects.toMatchObject({ code: 5 });
});

test('GetPayrollPdfUrlUseCase — throws PERMISSION_DENIED for wrong owner', async () => {
  const repo = makeRepo();
  const minio = { presignedGetObject: mock(async () => '') };
  const uc = new GetPayrollPdfUrlUseCase({
    payrollRepository: repo as never,
    minio: minio as never,
  });
  await expect(
    uc.execute({
      $type: 'payroll.GetPayrollPdfUrlRequest',
      payrollRecordId: 'pr1',
      requestorId: 'other',
    }),
  ).rejects.toMatchObject({ code: 7 });
});

test('buildPayslipText — produces payslip string with net pay', () => {
  const text = buildPayslipText({
    employeeId: 'e1',
    year: 2026,
    month: 1,
    monthlyRate: 5000,
    unpaidDays: 2,
    dailyRate: 166.67,
    netAmount: 4666.66,
    deduction: 333.34,
  });
  expect(text).toContain('PAYSLIP');
  expect(text).toContain('e1');
  expect(text).toContain('5000.00');
  expect(text).toContain('4666.66');
});
