import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "Payroll",
	schema: "./src/schemas/graphql/payroll.graphql",
	out: "../../packages/api/src/generated/payroll/graphql",
});
