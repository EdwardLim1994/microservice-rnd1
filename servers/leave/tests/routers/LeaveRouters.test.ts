import { expect, test } from "@rstest/core";
import { LeaveLeaveProto } from "api";
import { createContainer, InjectionMode } from "awilix";
import LeaveGraphqlRouter from "../../src/routers/LeaveGraphqlRouter";
import LeaveGrpcRouter from "../../src/routers/LeaveGrpcRouter";

function makeContainer() {
	return createContainer({ injectionMode: InjectionMode.PROXY });
}

test("LeaveGraphqlRouter exposes typeDefs and wires Query/Mutation/LeaveRequest handlers", () => {
	const router = new LeaveGraphqlRouter(makeContainer());

	expect(router.typeDefs).toContain("type LeaveRequest");
	expect(Object.keys(router.handlers.Query ?? {})).toEqual([
		"leaveRequests",
		"pendingLeaveRequestsForSupervisor",
	]);
	expect(Object.keys(router.handlers.Mutation ?? {})).toEqual([
		"submitLeave",
		"reviewLeave",
	]);
	expect(Object.keys(router.handlers.LeaveRequest ?? {})).toEqual([
		"__resolveReference",
		"employee",
		"reviewedBy",
	]);
});

test("LeaveGraphqlRouter.resolvers auto-registers use cases into the container", () => {
	const container = makeContainer();
	const router = new LeaveGraphqlRouter(container);

	expect(router.resolvers.Mutation).toHaveProperty("submitLeave");
	expect(container.hasRegistration("submitLeaveUseCase")).toBe(true);
});

test("LeaveGrpcRouter exposes the LeaveService definition and wires both RPCs", () => {
	const router = new LeaveGrpcRouter(makeContainer());

	expect(router.service).toBe(LeaveLeaveProto.LeaveServiceService);
	expect(Object.keys(router.handlers)).toEqual(["submitLeave", "reviewLeave"]);
});
