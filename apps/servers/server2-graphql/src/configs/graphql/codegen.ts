import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "Server2Graphql",
	schema: "./src/schemas/graphql/server2-graphql.graphql",
	out: "../../../packages/api/src/generated/server2-graphql/graphql",
});
