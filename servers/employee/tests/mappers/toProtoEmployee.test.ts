import { expect, test } from "@rstest/core";
import toProtoEmployee from "../../src/mappers/toProtoEmployee";

const now = new Date("2026-01-01T00:00:00.000Z");

test("maps a repository Employee record to the protobuf Employee shape", () => {
	const result = toProtoEmployee({
		id: "emp-1",
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
		supervisorId: "emp-2",
		createdAt: now,
		updatedAt: now,
	});

	expect(result).toEqual({
		$type: "employee.Employee",
		id: "emp-1",
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
		supervisorId: "emp-2",
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
	});
});

test("maps a null supervisorId to undefined", () => {
	const result = toProtoEmployee({
		id: "emp-1",
		firstName: "Jane",
		lastName: "Doe",
		gender: "FEMALE",
		email: "jane.doe@example.com",
		grossSalary: 5000,
		salaryPerDay: 200,
		supervisorId: null,
		createdAt: now,
		updatedAt: now,
	});

	expect(result.supervisorId).toBeUndefined();
});
