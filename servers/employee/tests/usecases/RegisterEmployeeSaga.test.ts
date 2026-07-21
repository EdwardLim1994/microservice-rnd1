import { expect, test } from "@rstest/core";
import { asValue, createContainer, InjectionMode } from "awilix";
import { AuthentikApiError, type AuthentikClient } from "server";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";
import RegisterEmployeeSaga from "../../src/usecases/RegisterEmployeeSaga";

const context = {
	firstName: "Jane",
	lastName: "Doe",
	gender: "FEMALE",
	email: "jane.doe@example.com",
	grossSalary: 5000,
	salaryPerDay: 200,
};

function makeContainer(options: {
	authentikFails?: boolean;
}) {
	const created: unknown[] = [];
	const deleted: string[] = [];

	const employeeRepository = {
		findById: async () => null,
		findByEmail: async () => null,
		create: async (data: Record<string, unknown>) => {
			const employee = { id: "emp-1", ...data };
			created.push(employee);
			return employee;
		},
		delete: async (id: string) => {
			deleted.push(id);
		},
	} as unknown as EmployeeRepository;

	const authentik = {
		createUser: async () => {
			if (options.authentikFails) {
				throw new AuthentikApiError(503, { detail: "Service Unavailable" });
			}
			return { pk: 1, username: context.email, email: context.email };
		},
	} as unknown as AuthentikClient;

	const container = createContainer({ injectionMode: InjectionMode.PROXY });
	container.register({
		container: asValue(container),
		employeeRepository: asValue(employeeRepository),
		authentik: asValue(authentik),
	});

	return { container, created: () => created, deleted: () => deleted };
}

test("creates the Employee record and Authentik account on the happy path", async () => {
	const { container, created, deleted } = makeContainer({});
	const saga = new RegisterEmployeeSaga({ container });

	const result = await saga.execute(context);

	expect(result.employeeId).toBe("emp-1");
	expect(result.temporaryPassword).toEqual(expect.any(String));
	expect(created()).toHaveLength(1);
	expect(deleted()).toEqual([]);
});

test("rolls back (deletes) the Employee record if the Authentik account creation fails", async () => {
	const { container, created, deleted } = makeContainer({ authentikFails: true });
	const saga = new RegisterEmployeeSaga({ container });

	await expect(saga.execute(context)).rejects.toBeInstanceOf(Error);

	expect(created()).toHaveLength(1);
	expect(deleted()).toEqual(["emp-1"]);
});
