import type { PayrollRecord as ProtoRecord } from 'api/src/generated/payroll/proto/payroll';

type PayrollRow = {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  monthlyRate: number;
  unpaidDays: number;
  dailyRate: number;
  deduction: number;
  netAmount: number;
  pdfKey: string;
  generatedAt: Date;
};

export function toProto(row: PayrollRow): ProtoRecord {
  return {
    $type: 'payroll.PayrollRecord',
    id: row.id,
    employeeId: row.employeeId,
    year: row.year,
    month: row.month,
    monthlyRate: row.monthlyRate,
    unpaidDays: row.unpaidDays,
    dailyRate: row.dailyRate,
    deduction: row.deduction,
    netAmount: row.netAmount,
    pdfKey: row.pdfKey,
    generatedAt: row.generatedAt,
  };
}

export function grpcNotFound(id: string): Error {
  return Object.assign(new Error(`PayrollRecord ${id} not found`), { code: 5 });
}

export function grpcPermissionDenied(msg: string): Error {
  return Object.assign(new Error(msg), { code: 7 });
}

// ponytail: plain-text "PDF" for POC — swap with pdf-lib or puppeteer when real formatting needed
export function buildPayslipText(data: {
  employeeId: string;
  year: number;
  month: number;
  monthlyRate: number;
  unpaidDays: number;
  dailyRate: number;
  deduction: number;
  netAmount: number;
}): string {
  const monthName = new Date(data.year, data.month - 1).toLocaleString(
    'en-MY',
    { month: 'long' },
  );
  return [
    'PAYSLIP',
    `Period: ${monthName} ${data.year}`,
    `Employee ID: ${data.employeeId}`,
    '',
    `Monthly Rate:  MYR ${data.monthlyRate.toFixed(2)}`,
    `Daily Rate:    MYR ${data.dailyRate.toFixed(2)}`,
    `Unpaid Days:   ${data.unpaidDays}`,
    `Deduction:     MYR ${data.deduction.toFixed(2)}`,
    '',
    `Net Pay:       MYR ${data.netAmount.toFixed(2)}`,
    '',
    `Generated at: ${new Date().toISOString()}`,
  ].join('\n');
}
