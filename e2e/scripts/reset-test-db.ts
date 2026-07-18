import { SQL } from "bun";

// Truncates every table the API test suite writes to, using each server's own static superuser
// connection (same "myuser"/"mypassword" convention as every server's own DATABASE_URL — see
// servers/<name>/.env.sample) — not Vault-issued creds, since those are scoped to a single
// dynamic role and don't need to change here. Run before and after `test:api` (see
// package.json's pretest:api/posttest:api hooks) so each run starts and ends on a clean slate
// instead of accumulating registered employees/leave requests/payslips across runs, which used
// to make generatePayslips (no per-period filtering, processes every row) progressively slower
// until it broke the test's own timeout.
const databases = [
	{
		url: process.env.EMPLOYEE_DATABASE_URL ?? "postgresql://myuser:mypassword@localhost:5101/employee",
		tables: ["Employee"],
	},
	{
		url: process.env.LEAVE_DATABASE_URL ?? "postgresql://myuser:mypassword@localhost:5104/leave",
		tables: ["LeaveRequest"],
	},
	{
		url: process.env.PAYROLL_DATABASE_URL ?? "postgresql://myuser:mypassword@localhost:5102/payroll",
		tables: ["Payslip", "Notification"],
	},
];

for (const { url, tables } of databases) {
	const sql = new SQL(url);
	try {
		await sql.unsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);
	} finally {
		await sql.close();
	}
}
