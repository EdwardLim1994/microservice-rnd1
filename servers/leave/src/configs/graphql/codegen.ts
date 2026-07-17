import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "Leave",
	schema: "./src/schemas/graphql/leave.graphql",
	out: "../../packages/api/src/generated/leave/graphql",
});
