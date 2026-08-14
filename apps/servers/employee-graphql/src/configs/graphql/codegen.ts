import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "EmployeeGraphql",
	schema: "./src/schemas/graphql/employee.graphql",
	out: "../../../packages/api/src/generated/employee-graphql/graphql",
});
