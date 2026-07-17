import { GraphQLError } from "graphql";
import { type AuthentikClient, AuthentikApiError, BaseUseCase } from "server";
import EmployeeRepository from "../repositories/EmployeeRepository";

interface RegisterEmployeeInput {
	fullName: string;
	employeeId: string;
	role: string;
	department: string;
	grossSalary: number;
	supervisorId?: string | null;
}

interface RegisterEmployeeResult {
	employee: {
		id: string;
		employeeId: string;
		fullName: string;
		role: string;
		department: string;
		grossSalary: number;
		supervisor: unknown;
		createdAt: Date;
	};
	temporaryPassword: string;
}

function generateTemporaryPassword(): string {
	// ponytail: random 16-char alphanumeric + symbol, good enough for a temporary/one-time
	// credential the user resets on first login. Swap for a policy-aware generator if Authentik's
	// password policy ever rejects this shape.
	return `Tmp-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}!`;
}

export default class RegisterEmployeeUseCase extends BaseUseCase<
	{ input: RegisterEmployeeInput },
	RegisterEmployeeResult
> {
	private readonly employeeRepository: EmployeeRepository;
	private readonly authentik: AuthentikClient;

	constructor({
		employeeRepository,
		authentik,
	}: {
		employeeRepository: EmployeeRepository;
		authentik: AuthentikClient;
	}) {
		super();
		this.employeeRepository = employeeRepository;
		this.authentik = authentik;
	}

	// GraphQL's `registerEmployee(input: RegisterEmployeeInput!)` resolves with a single
	// wrapped `{ input: {...} }` args object (GraphqlRouter passes the raw GraphQL args
	// object straight through) — not the flat fields directly. This must destructure `input`
	// out of that wrapper, not treat the wrapper itself as the flat shape.
	async execute({ input }: { input: RegisterEmployeeInput }): Promise<RegisterEmployeeResult> {
		const fullName = input.fullName.trim();
		const role = input.role.trim();
		const department = input.department.trim();

		if (!fullName || !role || !department) {
			throw new GraphQLError("fullName, role, and department must be non-empty", {
				extensions: { code: "VALIDATION_ERROR" },
			});
		}
		if (input.grossSalary <= 0) {
			throw new GraphQLError("grossSalary must be a positive number", {
				extensions: { code: "VALIDATION_ERROR" },
			});
		}

		if (input.supervisorId) {
			const supervisor = await this.employeeRepository.findById(input.supervisorId);
			if (!supervisor) {
				throw new GraphQLError("supervisorId does not exist", {
					extensions: { code: "NOT_FOUND" },
				});
			}
		}

		let employee: Awaited<ReturnType<EmployeeRepository["create"]>>;
		try {
			employee = await this.employeeRepository.create({
				employeeId: input.employeeId,
				fullName,
				role,
				department,
				grossSalary: input.grossSalary,
				supervisorId: input.supervisorId ?? null,
			});
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "P2002") {
				throw new GraphQLError("An employee with that employeeId already exists", {
					extensions: { code: "CONFLICT" },
				});
			}
			throw error;
		}

		const temporaryPassword = generateTemporaryPassword();
		try {
			await this.authentik.createUser({
				username: employee.employeeId,
				email: `${employee.employeeId}@employees.local`,
				name: fullName,
				password: temporaryPassword,
			});
		} catch (error) {
			await this.employeeRepository.delete(employee.id);
			if (error instanceof AuthentikApiError) {
				throw new GraphQLError("Failed to create Authentik account for employee", {
					extensions: { code: "AUTHENTIK_UNAVAILABLE" },
				});
			}
			throw error;
		}

		return { employee, temporaryPassword };
	}
}
