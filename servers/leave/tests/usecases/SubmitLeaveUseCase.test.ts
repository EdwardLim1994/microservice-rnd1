import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import type LeaveRequestRepository from "../../src/repositories/LeaveRequestRepository";
import SubmitLeaveUseCase from "../../src/usecases/SubmitLeaveUseCase";

// EmployeeServiceClient is constructed internally by SubmitLeaveUseCase (not injected) — stub
// global fetch instead, same convention as payroll's GeneratePayslipsUseCase.test.ts.
function stubEmployeeFetch(
	employee: { id: string; supervisor: { id: string } | null } | null,
) {
	globalThis.fetch = (async () =>
		new Response(JSON.stringify({ data: { employee } }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})) as unknown as typeof fetch;
}

function createMockRepo(options: { overlapping?: unknown } = {}) {
	const created: Record<string, unknown>[] = [];
	const repo = {
		async findApprovedOverlapping() {
			return options.overlapping ?? null;
		},
		async create(data: Record<string, unknown>) {
			const record = {
				id: "leave-1",
				status: "PENDING",
				submittedAt: new Date(),
				reviewedById: null,
				reviewedAt: null,
				...data,
			};
			created.push(record);
			return record;
		},
	};
	return {
		repo: repo as unknown as LeaveRequestRepository,
		created: () => created,
	};
}

function validInput(overrides: Record<string, unknown> = {}) {
	return {
		input: {
			employeeId: "emp-1",
			leaveType: "ANNUAL" as const,
			startDate: "2026-08-01",
			endDate: "2026-08-05",
			reason: "Family trip",
			...overrides,
		},
	};
}

test("INT-7-1: valid leave request is persisted with status PENDING", async () => {
	stubEmployeeFetch({ id: "emp-1", supervisor: null });
	const { repo, created } = createMockRepo();
	const useCase = new SubmitLeaveUseCase({ leaveRequestRepository: repo });

	const result = (await useCase.execute(validInput())) as { status: string };

	expect(result.status).toBe("PENDING");
	expect(created()).toHaveLength(1);
});

test("INT-7-2: startDate after endDate returns validation error", async () => {
	const { repo } = createMockRepo();
	const useCase = new SubmitLeaveUseCase({ leaveRequestRepository: repo });

	await expect(
		useCase.execute(
			validInput({ startDate: "2026-08-10", endDate: "2026-08-01" }),
		),
	).rejects.toMatchObject({
		extensions: { code: "VALIDATION_ERROR" },
	});
});

test("INT-7-3: non-existent employeeId returns not found error", async () => {
	stubEmployeeFetch(null);
	const { repo } = createMockRepo();
	const useCase = new SubmitLeaveUseCase({ leaveRequestRepository: repo });

	await expect(useCase.execute(validInput())).rejects.toMatchObject({
		extensions: { code: "NOT_FOUND" },
	});
});

test("INT-7-4: overlapping approved leave returns conflict error", async () => {
	stubEmployeeFetch({ id: "emp-1", supervisor: null });
	const { repo } = createMockRepo({ overlapping: { id: "existing" } });
	const useCase = new SubmitLeaveUseCase({ leaveRequestRepository: repo });

	await expect(useCase.execute(validInput())).rejects.toMatchObject({
		extensions: { code: "CONFLICT" },
	});
});

test("empty reason returns validation error", async () => {
	const { repo } = createMockRepo();
	const useCase = new SubmitLeaveUseCase({ leaveRequestRepository: repo });

	await expect(
		useCase.execute(validInput({ reason: "   " })),
	).rejects.toBeInstanceOf(GraphQLError);
});
