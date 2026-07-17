import type { Client } from "minio";
import { GraphQLError } from "graphql";
import { BaseUseCase } from "server";
import EmployeeServiceClient from "../clients/EmployeeServiceClient";
import { generatePayslipPdf } from "../lib/generatePayslipPdf";
import NotificationRepository from "../repositories/NotificationRepository";
import PayslipRepository from "../repositories/PayslipRepository";

interface GeneratePayslipsInput {
	month: number;
	year: number;
}

const MONTH_NAMES = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

const PAYSLIPS_BUCKET = "payslips";

export default class GeneratePayslipsUseCase extends BaseUseCase<
	{ input: GeneratePayslipsInput },
	unknown
> {
	private readonly payslipRepository: PayslipRepository;
	private readonly notificationRepository: NotificationRepository;
	private readonly minio: Client;
	private readonly employeeService: EmployeeServiceClient;

	constructor({
		payslipRepository,
		notificationRepository,
		minio,
	}: {
		payslipRepository: PayslipRepository;
		notificationRepository: NotificationRepository;
		minio: Client;
	}) {
		super();
		this.payslipRepository = payslipRepository;
		this.notificationRepository = notificationRepository;
		this.minio = minio;
		this.employeeService = new EmployeeServiceClient();
	}

	// See RegisterEmployeeUseCase's comment (employee server) — GraphQL's wrapped `input:`
	// argument arrives as `{ input: {...} }`, not the flat fields.
	async execute({ input: { month, year } }: { input: GeneratePayslipsInput }) {
		let employees: Awaited<ReturnType<EmployeeServiceClient["listEmployees"]>>;
		try {
			employees = await this.employeeService.listEmployees();
		} catch {
			throw new GraphQLError("employee service is unreachable", {
				extensions: { code: "EMPLOYEE_SERVICE_UNAVAILABLE" },
			});
		}

		const generated: Awaited<ReturnType<PayslipRepository["upsert"]>>[] = [];
		const failed: string[] = [];

		if (!(await this.minio.bucketExists(PAYSLIPS_BUCKET))) {
			await this.minio.makeBucket(PAYSLIPS_BUCKET);
		}

		for (const employee of employees) {
			try {
				const generatedAt = new Date();
				const pdfBytes = await generatePayslipPdf({
					fullName: employee.fullName,
					employeeId: employee.employeeId,
					role: employee.role,
					department: employee.department,
					grossSalary: employee.grossSalary,
					month,
					year,
					generatedAt,
				});

				const minioObjectKey = `${PAYSLIPS_BUCKET}/${employee.id}/${year}/${month}.pdf`;
				await this.minio.putObject(PAYSLIPS_BUCKET, minioObjectKey, Buffer.from(pdfBytes));

				const payslip = await this.payslipRepository.upsert({
					employeeId: employee.id,
					month,
					year,
					minioObjectKey,
				});
				generated.push(payslip);

				await this.notificationRepository.create({
					employeeId: employee.id,
					message: `Your ${MONTH_NAMES[month - 1]} ${year} payslip is ready`,
				});
			} catch (error) {
				console.error(`GeneratePayslipsUseCase: failed for employee ${employee.id}`, error);
				failed.push(employee.id);
			}
		}

		return { generated, failed };
	}
}
