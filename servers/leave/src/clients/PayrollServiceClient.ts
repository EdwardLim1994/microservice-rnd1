const CREATE_NOTIFICATION_MUTATION = `
  mutation CreateNotification($input: CreateNotificationInput!) {
    createNotification(input: $input) {
      id
    }
  }
`;

/**
 * Thin fetch client over payroll-subgraph's GraphQL endpoint — same "plain fetch, no SDK"
 * convention as this server's own EmployeeServiceClient / payroll's own EmployeeServiceClient
 * (see packages/server/CLAUDE.md).
 */
export default class PayrollServiceClient {
	private readonly baseUrl: string;

	constructor(
		baseUrl = process.env.PAYROLL_GRAPHQL_URL ?? "http://localhost:4002",
	) {
		this.baseUrl = baseUrl.replace(/\/$/, "");
	}

	async createNotification(employeeId: string, message: string): Promise<void> {
		const response = await fetch(`${this.baseUrl}/graphql`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				query: CREATE_NOTIFICATION_MUTATION,
				variables: { input: { employeeId, message } },
			}),
		});
		if (!response.ok) {
			throw new Error(`payroll-subgraph returned ${response.status}`);
		}
		const body = (await response.json()) as { errors?: unknown[] };
		if (body.errors?.length) {
			throw new Error(
				`payroll-subgraph returned errors: ${JSON.stringify(body.errors)}`,
			);
		}
	}
}
