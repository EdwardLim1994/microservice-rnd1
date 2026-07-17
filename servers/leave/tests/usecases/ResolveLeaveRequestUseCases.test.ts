import { expect, test } from "@rstest/core";
import type LeaveRequestRepository from "../../src/repositories/LeaveRequestRepository";
import ResolveLeaveRequestEmployeeUseCase from "../../src/usecases/ResolveLeaveRequestEmployeeUseCase";
import ResolveLeaveRequestReferenceUseCase from "../../src/usecases/ResolveLeaveRequestReferenceUseCase";
import ResolveLeaveRequestReviewedByUseCase from "../../src/usecases/ResolveLeaveRequestReviewedByUseCase";

test("ResolveLeaveRequestReferenceUseCase looks up the leave request by id", async () => {
	const repo = {
		findById: async (id: string) => ({ id, employeeId: "emp-1" }),
	} as unknown as LeaveRequestRepository;
	const useCase = new ResolveLeaveRequestReferenceUseCase({ leaveRequestRepository: repo });

	const result = await useCase.execute({ id: "leave-1" });

	expect(result).toEqual({ id: "leave-1", employeeId: "emp-1" });
});

test("ResolveLeaveRequestEmployeeUseCase returns an Employee entity stub", async () => {
	const useCase = new ResolveLeaveRequestEmployeeUseCase();

	const result = await useCase.execute({ employeeId: "emp-1" });

	expect(result).toEqual({ __typename: "Employee", id: "emp-1" });
});

test("ResolveLeaveRequestReviewedByUseCase returns null when reviewedById is null", async () => {
	const useCase = new ResolveLeaveRequestReviewedByUseCase();

	const result = await useCase.execute({ reviewedById: null });

	expect(result).toBeNull();
});

test("ResolveLeaveRequestReviewedByUseCase returns an Employee entity stub when reviewedById is set", async () => {
	const useCase = new ResolveLeaveRequestReviewedByUseCase();

	const result = await useCase.execute({ reviewedById: "sup-1" });

	expect(result).toEqual({ __typename: "Employee", id: "sup-1" });
});
