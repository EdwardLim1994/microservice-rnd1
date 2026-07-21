import { ProcedureOrchestrator } from "server";
import type { Employee } from "../../generated/prisma";
import CreateAuthentikAccountUseCase from "./CreateAuthentikAccountUseCase";
import CreateEmployeeUseCase from "./CreateEmployeeUseCase";
import DeleteEmployeeUseCase from "./DeleteEmployeeUseCase";
import NoopUseCase from "./NoopUseCase";

export interface RegisterEmployeeContext {
	firstName: string;
	lastName: string;
	gender: string;
	email: string;
	grossSalary: number;
	salaryPerDay: number;
	supervisorId?: string;
	employeeId?: string;
	employee?: Employee;
	temporaryPassword?: string;
}

// FEAT-1: Register new employee — creates the Employee record, then creates its Authentik account
// in the employee group with mustChangePassword true. If the Authentik call fails, the Employee
// record is rolled back (saga compensation) rather than left orphaned with no login credential.
export default class RegisterEmployeeSaga extends ProcedureOrchestrator<RegisterEmployeeContext> {
	protected build() {
		this.procedure(CreateEmployeeUseCase, DeleteEmployeeUseCase).procedure(
			CreateAuthentikAccountUseCase,
			NoopUseCase,
		);
	}
}
