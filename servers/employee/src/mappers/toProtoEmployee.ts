import type { EmployeeEmployeeProto } from "api";

interface EmployeeRecord {
	id: string;
	firstName: string;
	lastName: string;
	gender: string;
	email: string;
	grossSalary: number;
	salaryPerDay: number;
	supervisorId?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export default function toProtoEmployee(employee: EmployeeRecord): EmployeeEmployeeProto.Employee {
	return {
		$type: "employee.Employee",
		id: employee.id,
		firstName: employee.firstName,
		lastName: employee.lastName,
		gender: employee.gender,
		email: employee.email,
		grossSalary: employee.grossSalary,
		salaryPerDay: employee.salaryPerDay,
		supervisorId: employee.supervisorId ?? undefined,
		createdAt: employee.createdAt.toISOString(),
		updatedAt: employee.updatedAt.toISOString(),
	};
}
