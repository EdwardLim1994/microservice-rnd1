import { expect, test } from "@rstest/core";
import type LeaveRequestRepository from "../../src/repositories/LeaveRequestRepository";
import ListLeaveRequestsUseCase from "../../src/usecases/ListLeaveRequestsUseCase";

test("returns the leave requests for the given employee", async () => {
	const repo = {
		findByEmployee: async (employeeId: string) => [
			{ id: "leave-1", employeeId },
		],
	} as unknown as LeaveRequestRepository;
	const useCase = new ListLeaveRequestsUseCase({
		leaveRequestRepository: repo,
	});

	const result = await useCase.execute({ employeeId: "emp-1" });

	expect(result).toEqual([{ id: "leave-1", employeeId: "emp-1" }]);
});
