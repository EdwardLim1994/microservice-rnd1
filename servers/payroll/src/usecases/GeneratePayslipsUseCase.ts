import { GraphQLError } from "graphql";
import { BaseUseCase } from "server";
import EmployeeServiceClient from "../clients/EmployeeServiceClient";
import { generatePayslipPdf } from "../lib/generatePayslipPdf";
import type NotificationRepository from "../repositories/NotificationRepository";
import type StorePayslipUseCase from "./StorePayslipUseCase";

interface GeneratePayslipsInput {
	month: number;
	year: number;
}

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export default class GeneratePayslipsUseCase extends BaseUseCase<
	{ input: GeneratePayslipsInput },
	unknown
> {
	private readonly storePayslipUseCase: StorePayslipUseCase;
	private readonly notificationRepository: NotificationRepository;
	private readonly employeeService: EmployeeServiceClient;

	constructor({
		storePayslipUseCase,
		notificationRepository,
	}: {
		storePayslipUseCase: StorePayslipUseCase;
		notificationRepository: NotificationRepository;
	}) {
		super();
		this.storePayslipUseCase = storePayslipUseCase;
		this.notificationRepository = notificationRepository;
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

		const generated: unknown[] = [];
		const failed: string[] = [];

		for (const employee of employees) {
			try {
				const pdfBytes = await generatePayslipPdf({
					fullName: employee.fullName,
					employeeId: employee.employeeId,
					role: employee.role,
					department: employee.department,
					grossSalary: employee.grossSalary,
					month,
					year,
					generatedAt: new Date(),
				});

				// FEAT-4 — delegates to the standalone StorePayslip component (Minio upload +
				// Postgres persist) rather than duplicating that logic here.
				const payslip = await this.storePayslipUseCase.execute({
					input: { employeeId: employee.id, month, year, pdfBytes },
				});
				generated.push(payslip);

				await this.notificationRepository.create({
					employeeId: employee.id,
					message: `Your ${MONTH_NAMES[month - 1]} ${year} payslip is ready`,
				});
			} catch (error) {
				console.error(
					`GeneratePayslipsUseCase: failed for employee ${employee.id}`,
					error,
				);
				failed.push(employee.id);
			}
		}

		return { generated, failed };
	}
}
