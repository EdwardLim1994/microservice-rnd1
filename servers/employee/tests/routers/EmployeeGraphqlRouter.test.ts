import { expect, test } from "@rstest/core";
import { createContainer, InjectionMode } from "awilix";
import EmployeeGraphqlRouter from "../../src/routers/EmployeeGraphqlRouter";
import AssignSupervisorGraphqlUseCase from "../../src/usecases/AssignSupervisorGraphqlUseCase";
import RegisterEmployeeSaga from "../../src/usecases/RegisterEmployeeSaga";

function makeContainer() {
	return createContainer({ injectionMode: InjectionMode.PROXY });
}

test("typeDefs returns the employee-subgraph SDL", () => {
	const router = new EmployeeGraphqlRouter(makeContainer());

	expect(router.typeDefs).toContain("registerEmployee");
});

test("handlers maps Mutation.registerEmployee to RegisterEmployeeSaga", () => {
	const router = new EmployeeGraphqlRouter(makeContainer());

	expect(router.handlers.Mutation?.registerEmployee).toBe(RegisterEmployeeSaga);
});

test("handlers maps Mutation.assignSupervisor to AssignSupervisorGraphqlUseCase", () => {
	const router = new EmployeeGraphqlRouter(makeContainer());

	expect(router.handlers.Mutation?.assignSupervisor).toBe(AssignSupervisorGraphqlUseCase);
});

test("resolvers getter auto-registers RegisterEmployeeSaga in the container", () => {
	const container = makeContainer();
	const router = new EmployeeGraphqlRouter(container);

	const _ = router.resolvers;

	expect(container.hasRegistration("registerEmployeeSaga")).toBe(true);
});
