import { expect, test } from "@rstest/core";
import { asValue, createContainer, InjectionMode } from "awilix";
import { AuthentikApiError, type AuthentikClient } from "server";
import type EmployeeRepository from "../../src/repositories/EmployeeRepository";
import AssignSupervisorSaga from "../../src/usecases/AssignSupervisorSaga";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const SIX_YEARS_AGO = new Date("2020-01-01T00:00:00.000Z");

function makeContainer(options: { authentikFails?: boolean }) {
	const records: Record<string, { id: string; email: string; supervisorId: string | null; createdAt: Date }> = {
		"emp-1": { id: "emp-1", email: "emp1@example.com", supervisorId: null, createdAt: NOW },
		"sup-1": { id: "sup-1", email: "sup1@example.com", supervisorId: null, createdAt: SIX_YEARS_AGO },
	};
	const updateCalls: Array<{ id: string; supervisorId: string | null }> = [];

	const employeeRepository = {
		findById: async (id: string) => records[id] ?? null,
		updateSupervisor: async (id: string, supervisorId: string | null) => {
			updateCalls.push({ id, supervisorId });
			records[id] = { ...records[id], supervisorId };
			return records[id];
		},
	} as unknown as EmployeeRepository;

	const authentik = {
		updateUserGroups: async () => {
			if (options.authentikFails) {
				throw new AuthentikApiError(503, { detail: "unavailable" });
			}
		},
	} as unknown as AuthentikClient;

	const container = createContainer({ injectionMode: InjectionMode.PROXY });
	container.register({
		container: asValue(container),
		employeeRepository: asValue(employeeRepository),
		authentik: asValue(authentik),
	});

	return { container, updateCalls: () => updateCalls };
}

test("persists the new supervisorId and updates the Authentik group on the happy path", async () => {
	const { container, updateCalls } = makeContainer({});
	const saga = new AssignSupervisorSaga({ container });

	const result = await saga.execute({ employeeId: "emp-1", supervisorId: "sup-1" });

	expect(result.employee).toMatchObject({ id: "emp-1", supervisorId: "sup-1" });
	expect(updateCalls()).toEqual([{ id: "emp-1", supervisorId: "sup-1" }]);
});

test("reverts the supervisorId change if the Authentik group update fails", async () => {
	const { container, updateCalls } = makeContainer({ authentikFails: true });
	const saga = new AssignSupervisorSaga({ container });

	await expect(saga.execute({ employeeId: "emp-1", supervisorId: "sup-1" })).rejects.toBeInstanceOf(Error);

	// First call assigns sup-1, second (compensation) reverts back to the prior value (null).
	expect(updateCalls()).toEqual([
		{ id: "emp-1", supervisorId: "sup-1" },
		{ id: "emp-1", supervisorId: null },
	]);
});
