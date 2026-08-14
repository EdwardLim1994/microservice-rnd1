import { CronRouter } from 'server';
import { GeneratePayrollUseCase } from '../usecases/GeneratePayrollUseCase';

export class PayrollCronRouter extends CronRouter<{
  generatePayroll: string;
}> {
  get schedules() {
    // ponytail: run on the 1st of every month at 00:00 UTC; generates the previous month's payroll
    return { generatePayroll: '0 0 1 * *' } as const;
  }

  get handlers() {
    return { generatePayroll: GeneratePayrollUseCase };
  }
}
