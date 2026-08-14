import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "LeaveGraphql",
	schema: "./src/schemas/graphql/leave.graphql",
	out: "../../../packages/api/src/generated/leave-graphql/graphql",
});
