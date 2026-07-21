import { expect, test } from "@rstest/core";
import EmployeeRepository from "../../src/repositories/EmployeeRepository";

function makeMockPrisma() {
	const calls: Record<string, unknown[]> = {
		create: [],
		findUnique: [],
		delete: [],
		update: [],
		findMany: [],
	};
	const prisma = {
		employee: {
			create: async (args: unknown) => {
				calls.create.push(args);
				return { id: "emp-1" };
			},
			findUnique: async (args: unknown) => {
				calls.findUnique.push(args);
				return { id: "emp-1" };
			},
			delete: async (args: unknown) => {
				calls.delete.push(args);
				return { id: "emp-1" };
			},
			update: async (args: unknown) => {
				calls.update.push(args);
				return { id: "emp-1" };
			},
			findMany: async (args: unknown) => {
				calls.findMany.push(args);
				return [{ id: "emp-1" }];
			},
		},
	};
	return { prisma, calls };
}

test("create() delegates to prisma.employee.create with the given data", async () => {
	const { prisma, calls } = makeMockPrisma();
	// biome-ignore lint/suspicious/noExplicitAny: minimal mock, not a full PrismaClient
	const repository = new EmployeeRepository({ prisma: prisma as any });

	await repository.create({
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
	});

	expect(calls.create).toEqual([
		{ data: { firstName: "Jane", lastName: "Doe", gender: "FEMALE", email: "jane.doe@example.com", grossSalary: 5000, salaryPerDay: 200 } },
	]);
});

test("findById() delegates to prisma.employee.findUnique by id", async () => {
	const { prisma, calls } = makeMockPrisma();
	// biome-ignore lint/suspicious/noExplicitAny: minimal mock, not a full PrismaClient
	const repository = new EmployeeRepository({ prisma: prisma as any });

	await repository.findById("emp-1");

	expect(calls.findUnique).toEqual([{ where: { id: "emp-1" } }]);
});

test("findByEmail() delegates to prisma.employee.findUnique by email", async () => {
	const { prisma, calls } = makeMockPrisma();
	// biome-ignore lint/suspicious/noExplicitAny: minimal mock, not a full PrismaClient
	const repository = new EmployeeRepository({ prisma: prisma as any });

	await repository.findByEmail("jane.doe@example.com");

	expect(calls.findUnique).toEqual([{ where: { email: "jane.doe@example.com" } }]);
});

test("delete() delegates to prisma.employee.delete by id", async () => {
	const { prisma, calls } = makeMockPrisma();
	// biome-ignore lint/suspicious/noExplicitAny: minimal mock, not a full PrismaClient
	const repository = new EmployeeRepository({ prisma: prisma as any });

	await repository.delete("emp-1");

	expect(calls.delete).toEqual([{ where: { id: "emp-1" } }]);
});

test("updateSupervisor() delegates to prisma.employee.update with the given supervisorId", async () => {
	const { prisma, calls } = makeMockPrisma();
	// biome-ignore lint/suspicious/noExplicitAny: minimal mock, not a full PrismaClient
	const repository = new EmployeeRepository({ prisma: prisma as any });

	await repository.updateSupervisor("emp-1", "emp-2");

	expect(calls.update).toEqual([{ where: { id: "emp-1" }, data: { supervisorId: "emp-2" } }]);
});

test("updateSupervisor() accepts null to clear the supervisor", async () => {
	const { prisma, calls } = makeMockPrisma();
	// biome-ignore lint/suspicious/noExplicitAny: minimal mock, not a full PrismaClient
	const repository = new EmployeeRepository({ prisma: prisma as any });

	await repository.updateSupervisor("emp-1", null);

	expect(calls.update).toEqual([{ where: { id: "emp-1" }, data: { supervisorId: null } }]);
});

test("findAll() delegates to prisma.employee.findMany with no filter", async () => {
	const { prisma, calls } = makeMockPrisma();
	// biome-ignore lint/suspicious/noExplicitAny: minimal mock, not a full PrismaClient
	const repository = new EmployeeRepository({ prisma: prisma as any });

	await repository.findAll();

	expect(calls.findMany).toEqual([undefined]);
});
