export interface RemoteEmployee {
	id: string;
	supervisorId: string | null;
}

const EMPLOYEE_QUERY = `
  query Employee($id: ID!) {
    employee(id: $id) {
      id
      supervisor { id }
    }
  }
`;

const EMPLOYEES_QUERY = `
  query Employees {
    employees {
      id
      supervisor { id }
    }
  }
`;

/**
 * Thin fetch client over employee-subgraph's GraphQL endpoint — same "plain fetch, no SDK"
 * convention as payroll's own EmployeeServiceClient / AuthentikClient (see
 * packages/server/CLAUDE.md).
 */
export default class EmployeeServiceClient {
	private readonly baseUrl: string;

	constructor(baseUrl = process.env.EMPLOYEE_GRAPHQL_URL ?? "http://localhost:4001") {
		this.baseUrl = baseUrl.replace(/\/$/, "");
	}

	private async graphql(query: string, variables: Record<string, unknown>) {
		const response = await fetch(`${this.baseUrl}/graphql`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query, variables }),
		});
		if (!response.ok) {
			throw new Error(`employee-subgraph returned ${response.status}`);
		}
		const body = (await response.json()) as { data?: Record<string, unknown>; errors?: unknown[] };
		if (body.errors?.length) {
			throw new Error(`employee-subgraph returned errors: ${JSON.stringify(body.errors)}`);
		}
		return body.data;
	}

	async findEmployee(id: string): Promise<RemoteEmployee | null> {
		const data = (await this.graphql(EMPLOYEE_QUERY, { id })) as {
			employee: { id: string; supervisor: { id: string } | null } | null;
		};
		const employee = data.employee;
		if (!employee) return null;
		return { id: employee.id, supervisorId: employee.supervisor?.id ?? null };
	}

	async listDirectReports(supervisorId: string): Promise<RemoteEmployee[]> {
		const data = (await this.graphql(EMPLOYEES_QUERY, {})) as {
			employees: { id: string; supervisor: { id: string } | null }[];
		};
		return data.employees
			.filter((employee) => employee.supervisor?.id === supervisorId)
			.map((employee) => ({ id: employee.id, supervisorId: employee.supervisor?.id ?? null }));
	}
}
