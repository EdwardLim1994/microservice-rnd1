import { BaseRepository } from 'server';
import type { PrismaClient } from '../../generated/prisma';

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

export class PayrollRepository extends BaseRepository<PrismaClient> {
  async upsert(
    data: Omit<PayrollRow, 'id' | 'generatedAt'>,
  ): Promise<PayrollRow> {
    return this.prisma.payrollRecord.upsert({
      where: {
        employeeId_year_month: {
          employeeId: data.employeeId,
          year: data.year,
          month: data.month,
        },
      },
      create: data,
      update: data,
    });
  }

  async findByEmployee(
    employeeId: string,
    year?: number,
    page = 1,
    pageSize = 20,
  ): Promise<{ records: PayrollRow[]; total: number }> {
    const where = { employeeId, ...(year ? { year } : {}) };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.payrollRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.payrollRecord.count({ where }),
    ]);
    return { records, total };
  }

  async findById(id: string): Promise<PayrollRow | null> {
    return this.prisma.payrollRecord.findUnique({ where: { id } });
  }
}
