import { expect, test } from "@rstest/core";
import type LeaveRequestRepository from "../../src/repositories/LeaveRequestRepository";
import ListPendingLeaveRequestsForSupervisorUseCase from "../../src/usecases/ListPendingLeaveRequestsForSupervisorUseCase";

// EmployeeServiceClient is constructed internally (not injected) — stub global fetch instead,
// same convention as payroll's GeneratePayslipsUseCase.test.ts.
function stubEmployeesFetch(
	employees: { id: string; supervisor: { id: string } | null }[],
) {
	globalThis.fetch = (async () =>
		new Response(JSON.stringify({ data: { employees } }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})) as unknown as typeof fetch;
}

test("returns pending leave requests for the supervisor's direct reports", async () => {
	stubEmployeesFetch([{ id: "emp-1", supervisor: { id: "sup-1" } }]);
	const repo = {
		findPendingForEmployees: async (employeeIds: string[]) =>
			employeeIds.map((employeeId) => ({
				id: `leave-${employeeId}`,
				employeeId,
				status: "PENDING",
			})),
	} as unknown as LeaveRequestRepository;
	const useCase = new ListPendingLeaveRequestsForSupervisorUseCase({
		leaveRequestRepository: repo,
	});

	const result = await useCase.execute({ supervisorId: "sup-1" });

	expect(result).toEqual([
		{ id: "leave-emp-1", employeeId: "emp-1", status: "PENDING" },
	]);
});

test("returns an empty list without querying the repository when there are no direct reports", async () => {
	stubEmployeesFetch([]);
	let called = false;
	const repo = {
		findPendingForEmployees: async () => {
			called = true;
			return [];
		},
	} as unknown as LeaveRequestRepository;
	const useCase = new ListPendingLeaveRequestsForSupervisorUseCase({
		leaveRequestRepository: repo,
	});

	const result = await useCase.execute({ supervisorId: "sup-1" });

	expect(result).toEqual([]);
	expect(called).toBe(false);
});
