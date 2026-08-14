import { BaseRepository } from 'server';
import type { PrismaClient } from '../../generated/prisma';

type EmployeeRow = {
  id: string;
  fullName: string;
  personalEmail: string;
  monthlyRate: number;
  supervisorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class EmployeeRepository extends BaseRepository<PrismaClient> {
  async create(data: {
    fullName: string;
    personalEmail: string;
    monthlyRate: number;
    supervisorId?: string;
  }): Promise<EmployeeRow> {
    return this.prisma.employee.create({ data });
  }

  async update(
    id: string,
    data: { monthlyRate?: number; supervisorId?: string | null },
  ): Promise<EmployeeRow> {
    return this.prisma.employee.update({ where: { id }, data });
  }

  async findById(id: string): Promise<EmployeeRow | null> {
    return this.prisma.employee.findUnique({ where: { id } });
  }

  async findAll(
    page: number,
    pageSize: number,
  ): Promise<{ employees: EmployeeRow[]; total: number }> {
    const [employees, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count(),
    ]);
    return { employees, total };
  }

  // ponytail: iterative walk, bounded at 20 levels — SQL recursive CTE is faster but YAGNI for POC
  async getSupervisorChain(employeeId: string): Promise<EmployeeRow[]> {
    const chain: EmployeeRow[] = [];
    let current = await this.findById(employeeId);
    for (let i = 0; i < 20 && current?.supervisorId; i++) {
      const supervisor = await this.findById(current.supervisorId);
      if (!supervisor) break;
      chain.push(supervisor);
      current = supervisor;
    }
    return chain;
  }
}
