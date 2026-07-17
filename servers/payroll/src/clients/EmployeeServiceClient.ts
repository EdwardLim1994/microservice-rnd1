export interface RemoteEmployee {
	id: string;
	employeeId: string;
	fullName: string;
	role: string;
	department: string;
	grossSalary: number;
}

const EMPLOYEES_QUERY = `
  query Employees {
    employees {
      id
      employeeId
      fullName
      role
      department
      grossSalary
    }
  }
`;

/**
 * Thin fetch client over employee-subgraph's GraphQL endpoint — same "plain fetch, no SDK"
 * convention as AuthentikClient/VaultPgAdapter (see packages/server/CLAUDE.md). Talks to the
 * subgraph directly (not through Apollo Router), same as any other server-to-server call in
 * this framework today.
 */
export default class EmployeeServiceClient {
	private readonly baseUrl: string;

	constructor(baseUrl = process.env.EMPLOYEE_GRAPHQL_URL ?? "http://localhost:4001") {
		this.baseUrl = baseUrl.replace(/\/$/, "");
	}

	async listEmployees(): Promise<RemoteEmployee[]> {
		const response = await fetch(`${this.baseUrl}/graphql`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query: EMPLOYEES_QUERY }),
		});
		if (!response.ok) {
			throw new Error(`employee-subgraph returned ${response.status}`);
		}
		const body = (await response.json()) as { data?: { employees?: RemoteEmployee[] }; errors?: unknown[] };
		if (body.errors?.length) {
			throw new Error(`employee-subgraph returned errors: ${JSON.stringify(body.errors)}`);
		}
		return body.data?.employees ?? [];
	}
}
