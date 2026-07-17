import { expect, test } from "@rstest/core";
import EmployeeServiceClient from "../../src/clients/EmployeeServiceClient";

function withMockFetch<T>(response: Response, run: () => Promise<T>) {
	const original = globalThis.fetch;
	globalThis.fetch = (async () => response) as unknown as typeof fetch;
	return run().finally(() => {
		globalThis.fetch = original;
	});
}

function jsonResponse(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

test("findEmployee returns the employee with its supervisorId", async () => {
	const client = new EmployeeServiceClient("http://employee.test");
	const result = await withMockFetch(
		jsonResponse(200, {
			data: { employee: { id: "emp-1", supervisor: { id: "sup-1" } } },
		}),
		() => client.findEmployee("emp-1"),
	);

	expect(result).toEqual({ id: "emp-1", supervisorId: "sup-1" });
});

test("findEmployee returns null supervisorId when there is no supervisor", async () => {
	const client = new EmployeeServiceClient("http://employee.test");
	const result = await withMockFetch(
		jsonResponse(200, {
			data: { employee: { id: "emp-1", supervisor: null } },
		}),
		() => client.findEmployee("emp-1"),
	);

	expect(result).toEqual({ id: "emp-1", supervisorId: null });
});

test("findEmployee returns null when the employee does not exist", async () => {
	const client = new EmployeeServiceClient("http://employee.test");
	const result = await withMockFetch(
		jsonResponse(200, { data: { employee: null } }),
		() => client.findEmployee("missing"),
	);

	expect(result).toBeNull();
});

test("throws when employee-subgraph returns a non-2xx response", async () => {
	const client = new EmployeeServiceClient("http://employee.test");
	await expect(
		withMockFetch(new Response(null, { status: 500 }), () =>
			client.findEmployee("emp-1"),
		),
	).rejects.toThrow("employee-subgraph returned 500");
});

test("throws when employee-subgraph returns GraphQL errors", async () => {
	const client = new EmployeeServiceClient("http://employee.test");
	await expect(
		withMockFetch(jsonResponse(200, { errors: [{ message: "boom" }] }), () =>
			client.findEmployee("emp-1"),
		),
	).rejects.toThrow("employee-subgraph returned errors");
});

test("listDirectReports filters employees by supervisorId", async () => {
	const client = new EmployeeServiceClient("http://employee.test");
	const result = await withMockFetch(
		jsonResponse(200, {
			data: {
				employees: [
					{ id: "emp-1", supervisor: { id: "sup-1" } },
					{ id: "emp-2", supervisor: { id: "sup-2" } },
				],
			},
		}),
		() => client.listDirectReports("sup-1"),
	);

	expect(result).toEqual([{ id: "emp-1", supervisorId: "sup-1" }]);
});
