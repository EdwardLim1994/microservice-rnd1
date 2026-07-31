import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "Server1Graphql",
	schema: "./src/schemas/graphql/server1-graphql.graphql",
	out: "../../../packages/api/src/generated/server1-graphql/graphql",
});
