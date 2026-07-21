import { EmployeeEmployeeProto } from "api";
import { expect, test } from "@rstest/core";
import { createContainer, InjectionMode } from "awilix";
import EmployeeGrpcRouter from "../../src/routers/EmployeeGrpcRouter";
import AssignSupervisorGrpcUseCase from "../../src/usecases/AssignSupervisorGrpcUseCase";
import ListEmployeesGrpcUseCase from "../../src/usecases/ListEmployeesGrpcUseCase";
import RegisterEmployeeGrpcUseCase from "../../src/usecases/RegisterEmployeeGrpcUseCase";

function makeContainer() {
	return createContainer({ injectionMode: InjectionMode.PROXY });
}

test("service returns the generated EmployeeServiceService definition", () => {
	const router = new EmployeeGrpcRouter(makeContainer());

	expect(router.service).toBe(EmployeeEmployeeProto.EmployeeServiceService);
});

test("handlers maps registerEmployee to RegisterEmployeeGrpcUseCase", () => {
	const router = new EmployeeGrpcRouter(makeContainer());

	expect(router.handlers.registerEmployee).toBe(RegisterEmployeeGrpcUseCase);
});

test("handlers maps assignSupervisor to AssignSupervisorGrpcUseCase", () => {
	const router = new EmployeeGrpcRouter(makeContainer());

	expect(router.handlers.assignSupervisor).toBe(AssignSupervisorGrpcUseCase);
});

test("handlers maps listEmployees to ListEmployeesGrpcUseCase", () => {
	const router = new EmployeeGrpcRouter(makeContainer());

	expect(router.handlers.listEmployees).toBe(ListEmployeesGrpcUseCase);
});
