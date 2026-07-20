import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "Employee",
	schema: "./src/schemas/graphql/employee.graphql",
	out: "../../packages/api/src/generated/employee/graphql",
});
