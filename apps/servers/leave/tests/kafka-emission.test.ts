import { expect, mock, test } from "bun:test";
import { ReviewLeaveUseCase } from "../src/usecases/ReviewLeaveUseCase";
import { SubmitLeaveUseCase } from "../src/usecases/SubmitLeaveUseCase";

const start = new Date("2026-09-01");
const end = new Date("2026-09-03");

function makeLeaveRepo(overrides: Record<string, unknown> = {}) {
	return {
		getOrCreateBalance: mock(async () => ({
			employeeId: "e1",
			year: 2026,
			annualRemaining: 14,
			sickRemaining: 14,
		})),
		deductBalance: mock(async () => {}),
		createLeaveRequest: mock(async () => ({
			id: "lr1",
			employeeId: "e1",
			leaveType: "ANNUAL" as const,
			startDate: start,
			endDate: end,
			days: 2,
			status: "PENDING" as const,
			unpaidDays: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
		findLeaveById: mock(async () => ({
			id: "lr1",
			employeeId: "e1",
			leaveType: "ANNUAL" as const,
			startDate: start,
			endDate: end,
			days: 2,
			status: "PENDING" as const,
			unpaidDays: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
		updateLeaveStatus: mock(async (_id: string, status: string) => ({
			id: "lr1",
			employeeId: "e1",
			leaveType: "ANNUAL" as const,
			startDate: start,
			endDate: end,
			days: 2,
			status: status as "APPROVED",
			unpaidDays: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
		...overrides,
	};
}

test("SubmitLeaveUseCase — emits LEAVE_REQUEST_RECEIVED event", async () => {
	const kafkaProducer = { send: mock(async () => {}) };
	const leaveRepository = makeLeaveRepo();
	const uc = new SubmitLeaveUseCase({
		leaveRepository: leaveRepository as never,
		kafkaProducer,
	});

	await uc.execute({
		$type: "leave.SubmitLeaveRequest",
		employeeId: "e1",
		leaveType: 0, // ANNUAL
		startDate: start,
		endDate: end,
	});

	expect(kafkaProducer.send).toHaveBeenCalledWith(
		"notification-events",
		expect.objectContaining({
			recipientId: "e1",
			type: "LEAVE_REQUEST_RECEIVED",
		}),
	);
});

test("ReviewLeaveUseCase — emits LEAVE_REQUEST_DECIDED event on approval", async () => {
	const kafkaProducer = { send: mock(async () => {}) };
	const leaveRepository = makeLeaveRepo();
	const uc = new ReviewLeaveUseCase({
		leaveRepository: leaveRepository as never,
		kafkaProducer,
	});

	await uc.execute({
		$type: "leave.ReviewLeaveRequest",
		leaveRequestId: "lr1",
		reviewerId: "manager1", // different from employeeId "e1"
		decision: 1, // APPROVED
	});

	expect(kafkaProducer.send).toHaveBeenCalledWith(
		"notification-events",
		expect.objectContaining({
			recipientId: "e1",
			type: "LEAVE_REQUEST_DECIDED",
		}),
	);
});

test("ReviewLeaveUseCase — emits LEAVE_REQUEST_DECIDED event on rejection", async () => {
	const kafkaProducer = { send: mock(async () => {}) };
	const leaveRepository = makeLeaveRepo();
	const uc = new ReviewLeaveUseCase({
		leaveRepository: leaveRepository as never,
		kafkaProducer,
	});

	await uc.execute({
		$type: "leave.ReviewLeaveRequest",
		leaveRequestId: "lr1",
		reviewerId: "manager1",
		decision: 2, // REJECTED
	});

	expect(kafkaProducer.send).toHaveBeenCalledWith(
		"notification-events",
		expect.objectContaining({
			type: "LEAVE_REQUEST_DECIDED",
			message: "Your leave request has been rejected.",
		}),
	);
});
