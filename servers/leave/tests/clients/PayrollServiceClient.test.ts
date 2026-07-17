import { expect, test } from "@rstest/core";
import PayrollServiceClient from "../../src/clients/PayrollServiceClient";

function withMockFetch<T>(response: Response, run: () => Promise<T>) {
	const original = globalThis.fetch;
	globalThis.fetch = (async () => response) as unknown as typeof fetch;
	return run().finally(() => {
		globalThis.fetch = original;
	});
}

function jsonResponse(status: number, body: unknown) {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("createNotification resolves on success", async () => {
	const client = new PayrollServiceClient("http://payroll.test");
	await withMockFetch(jsonResponse(200, { data: { createNotification: { id: "notif-1" } } }), () =>
		client.createNotification("emp-1", "Your leave request was approved."),
	);
});

test("throws when payroll-subgraph returns a non-2xx response", async () => {
	const client = new PayrollServiceClient("http://payroll.test");
	await expect(
		withMockFetch(new Response(null, { status: 500 }), () => client.createNotification("emp-1", "msg")),
	).rejects.toThrow("payroll-subgraph returned 500");
});

test("throws when payroll-subgraph returns GraphQL errors", async () => {
	const client = new PayrollServiceClient("http://payroll.test");
	await expect(
		withMockFetch(jsonResponse(200, { errors: [{ message: "boom" }] }), () =>
			client.createNotification("emp-1", "msg"),
		),
	).rejects.toThrow("payroll-subgraph returned errors");
});
