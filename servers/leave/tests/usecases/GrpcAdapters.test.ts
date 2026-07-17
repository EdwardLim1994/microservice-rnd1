import { expect, test } from "@rstest/core";
import { LeaveLeaveProto } from "api";
import ReviewLeaveGrpcUseCase from "../../src/usecases/ReviewLeaveGrpcUseCase";
import type ReviewLeaveUseCase from "../../src/usecases/ReviewLeaveUseCase";
import SubmitLeaveGrpcUseCase from "../../src/usecases/SubmitLeaveGrpcUseCase";
import type SubmitLeaveUseCase from "../../src/usecases/SubmitLeaveUseCase";
import toLeaveRequestMessage from "../../src/usecases/toLeaveRequestMessage";

const domainLeaveRequest = {
	id: "leave-1",
	employeeId: "emp-1",
	leaveType: "ANNUAL",
	startDate: new Date("2026-08-01"),
	endDate: new Date("2026-08-05"),
	reason: "Trip",
	status: "PENDING",
	submittedAt: new Date("2026-07-01T00:00:00.000Z"),
	reviewedById: null,
	reviewedAt: null,
};

test("toLeaveRequestMessage maps the domain shape to the proto wire format", () => {
	const result = toLeaveRequestMessage(domainLeaveRequest);

	expect(result).toEqual({
		$type: "leave.LeaveRequest",
		id: "leave-1",
		employeeId: "emp-1",
		leaveType: "ANNUAL",
		startDate: "2026-08-01",
		endDate: "2026-08-05",
		reason: "Trip",
		status: "PENDING",
		submittedAt: "2026-07-01T00:00:00.000Z",
		reviewedById: "",
		reviewedAt: "",
	});
});

test("toLeaveRequestMessage fills reviewedById/reviewedAt when present", () => {
	const result = toLeaveRequestMessage({
		...domainLeaveRequest,
		status: "APPROVED",
		reviewedById: "sup-1",
		reviewedAt: new Date("2026-07-02T00:00:00.000Z"),
	});

	expect(result.reviewedById).toBe("sup-1");
	expect(result.reviewedAt).toBe("2026-07-02T00:00:00.000Z");
});

test("SubmitLeaveGrpcUseCase delegates to SubmitLeaveUseCase and maps the response", async () => {
	const mockUseCase = {
		execute: async () => domainLeaveRequest,
	} as unknown as SubmitLeaveUseCase;
	const grpcUseCase = new SubmitLeaveGrpcUseCase({
		submitLeaveUseCase: mockUseCase,
	});

	const result = await grpcUseCase.execute({
		$type: "leave.SubmitLeaveRequest",
		employeeId: "emp-1",
		leaveType: LeaveLeaveProto.LeaveType.ANNUAL,
		startDate: "2026-08-01",
		endDate: "2026-08-05",
		reason: "Trip",
	});

	expect(result.id).toBe("leave-1");
	expect(result.status).toBe("PENDING");
});

test("ReviewLeaveGrpcUseCase delegates to ReviewLeaveUseCase and maps the response", async () => {
	const reviewed = {
		...domainLeaveRequest,
		status: "APPROVED",
		reviewedById: "sup-1",
		reviewedAt: new Date(),
	};
	const mockUseCase = {
		execute: async () => reviewed,
	} as unknown as ReviewLeaveUseCase;
	const grpcUseCase = new ReviewLeaveGrpcUseCase({
		reviewLeaveUseCase: mockUseCase,
	});

	const result = await grpcUseCase.execute({
		$type: "leave.ReviewLeaveRequest",
		leaveRequestId: "leave-1",
		supervisorId: "sup-1",
		decision: LeaveLeaveProto.LeaveStatus.APPROVED,
	});

	expect(result.status).toBe("APPROVED");
	expect(result.reviewedById).toBe("sup-1");
});
