import type { Employee as ProtoEmployee } from "api/src/generated/employee/proto/employee";

type EmployeeRow = {
	id: string;
	fullName: string;
	personalEmail: string;
	monthlyRate: number;
	supervisorId: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export function toProto(row: EmployeeRow): ProtoEmployee {
	return {
		$type: "employee.Employee",
		id: row.id,
		fullName: row.fullName,
		personalEmail: row.personalEmail,
		monthlyRate: row.monthlyRate,
		supervisorId: row.supervisorId ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";

export function generatePassword(): string {
	const arr = new Uint8Array(12);
	crypto.getRandomValues(arr);
	return Array.from(arr, (b) => CHARS[b % CHARS.length]).join("");
}

export function grpcNotFound(id: string): Error {
	return Object.assign(new Error(`Employee ${id} not found`), { code: 5 });
}
