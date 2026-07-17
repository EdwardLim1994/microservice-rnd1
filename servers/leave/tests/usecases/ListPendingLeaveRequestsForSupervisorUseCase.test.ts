import { expect, test } from "@rstest/core";
import type EmployeeServiceClient from "../../src/clients/EmployeeServiceClient";
import type LeaveRequestRepository from "../../src/repositories/LeaveRequestRepository";
import ListPendingLeaveRequestsForSupervisorUseCase from "../../src/usecases/ListPendingLeaveRequestsForSupervisorUseCase";

test("returns pending leave requests for the supervisor's direct reports", async () => {
	const repo = {
		findPendingForEmployees: async (employeeIds: string[]) =>
			employeeIds.map((employeeId) => ({ id: `leave-${employeeId}`, employeeId, status: "PENDING" })),
	} as unknown as LeaveRequestRepository;
	const employeeServiceClient = {
		listDirectReports: async () => [{ id: "emp-1", supervisorId: "sup-1" }],
	} as unknown as EmployeeServiceClient;
	const useCase = new ListPendingLeaveRequestsForSupervisorUseCase({
		leaveRequestRepository: repo,
		employeeServiceClient,
	});

	const result = await useCase.execute({ supervisorId: "sup-1" });

	expect(result).toEqual([{ id: "leave-emp-1", employeeId: "emp-1", status: "PENDING" }]);
});

test("returns an empty list without querying the repository when there are no direct reports", async () => {
	let called = false;
	const repo = {
		findPendingForEmployees: async () => {
			called = true;
			return [];
		},
	} as unknown as LeaveRequestRepository;
	const employeeServiceClient = {
		listDirectReports: async () => [],
	} as unknown as EmployeeServiceClient;
	const useCase = new ListPendingLeaveRequestsForSupervisorUseCase({
		leaveRequestRepository: repo,
		employeeServiceClient,
	});

	const result = await useCase.execute({ supervisorId: "sup-1" });

	expect(result).toEqual([]);
	expect(called).toBe(false);
});
