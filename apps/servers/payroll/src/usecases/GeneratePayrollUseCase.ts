import { credentials } from '@grpc/grpc-js';
import {
  EmployeeServiceClient,
  type ListEmployeesResponse,
} from 'api/src/generated/employee/proto/employee';
import {
  type GetUnpaidLeaveDaysResponse,
  LeaveServiceClient,
} from 'api/src/generated/leave/proto/leave';
import { Kafka } from 'kafkajs';
import type { Client as MinioClient } from 'minio';
import { BaseUseCase } from 'server';
import type { PayrollRepository } from '../repositories/PayrollRepository';
import { buildPayslipText } from './helpers';

const PAYROLL_BUCKET = 'payroll';
const NOTIFICATION_TOPIC = 'notification-events';
// ponytail: 30-day denominator for all months — real payroll would use actual working days
const DAYS_IN_MONTH = 30;

export class GeneratePayrollUseCase extends BaseUseCase<void, void> {
  constructor(
    private readonly deps: {
      payrollRepository: PayrollRepository;
      minio: MinioClient;
    },
  ) {
    super();
  }

  async execute(): Promise<void> {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = prevMonth.getMonth() + 1;

    const employeeAddr = process.env.EMPLOYEE_GRPC_ADDR ?? 'employee:5001';
    const leaveAddr = process.env.LEAVE_GRPC_ADDR ?? 'leave:5002';
    const kafkaBrokers = (process.env.KAFKA_BROKERS ?? 'kafka:9092').split(',');

    const empClient = new EmployeeServiceClient(
      employeeAddr,
      credentials.createInsecure(),
    );
    const leaveClient = new LeaveServiceClient(
      leaveAddr,
      credentials.createInsecure(),
    );

    const employees = await this.listAllEmployees(empClient);

    await this.ensureBucket();

    const kafka = new Kafka({ brokers: kafkaBrokers, clientId: 'payroll' });
    const producer = kafka.producer();
    await producer.connect();

    try {
      await Promise.all(
        employees.map((emp) =>
          this.generateForEmployee(emp, year, month, leaveClient, producer),
        ),
      );
    } finally {
      await producer.disconnect();
      empClient.close();
      leaveClient.close();
    }
  }

  private async listAllEmployees(
    client: EmployeeServiceClient,
  ): Promise<Array<{ id: string; monthlyRate: number }>> {
    const results: Array<{ id: string; monthlyRate: number }> = [];
    let page = 1;
    while (true) {
      const resp: ListEmployeesResponse = await new Promise(
        (resolve, reject) => {
          client.listEmployees(
            { $type: 'employee.ListEmployeesRequest', page, pageSize: 100 },
            (err, res) => (err ? reject(err) : resolve(res!)),
          );
        },
      );
      for (const e of resp.employees) {
        results.push({ id: e.id, monthlyRate: e.monthlyRate });
      }
      if (results.length >= resp.total) break;
      page++;
    }
    return results;
  }

  private async generateForEmployee(
    emp: { id: string; monthlyRate: number },
    year: number,
    month: number,
    leaveClient: LeaveServiceClient,
    producer: Awaited<ReturnType<Kafka['producer']>>,
  ): Promise<void> {
    const unpaidResp: GetUnpaidLeaveDaysResponse = await new Promise(
      (resolve, reject) => {
        leaveClient.getUnpaidLeaveDays(
          {
            $type: 'leave.GetUnpaidLeaveDaysRequest',
            employeeId: emp.id,
            year,
            month,
          },
          (err, res) => (err ? reject(err) : resolve(res!)),
        );
      },
    );

    const unpaidDays = unpaidResp.unpaidDays;
    const dailyRate = emp.monthlyRate / DAYS_IN_MONTH;
    const deduction = unpaidDays * dailyRate;
    const netAmount = emp.monthlyRate - deduction;

    const pdfKey = `${emp.id}/${year}/${month}.pdf`;
    const pdfContent = buildPayslipText({
      employeeId: emp.id,
      year,
      month,
      monthlyRate: emp.monthlyRate,
      unpaidDays,
      dailyRate,
      deduction,
      netAmount,
    });

    await this.deps.minio.putObject(
      PAYROLL_BUCKET,
      pdfKey,
      Buffer.from(pdfContent, 'utf-8'),
      { 'Content-Type': 'application/pdf' },
    );

    const record = await this.deps.payrollRepository.upsert({
      employeeId: emp.id,
      year,
      month,
      monthlyRate: emp.monthlyRate,
      unpaidDays,
      dailyRate,
      deduction,
      netAmount,
      pdfKey,
    });

    await producer.send({
      topic: NOTIFICATION_TOPIC,
      messages: [
        {
          key: emp.id,
          value: JSON.stringify({
            type: 'PAYROLL_GENERATED',
            employeeId: emp.id,
            payrollRecordId: record.id,
            year,
            month,
          }),
        },
      ],
    });
  }

  private async ensureBucket(): Promise<void> {
    const exists = await this.deps.minio.bucketExists(PAYROLL_BUCKET);
    if (!exists) await this.deps.minio.makeBucket(PAYROLL_BUCKET);
  }
}
