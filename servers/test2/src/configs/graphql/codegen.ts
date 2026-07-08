import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "Test2",
	schema: "./src/schemas/graphql/test2.graphql",
	out: "../../packages/api/src/generated/test2/graphql",
});
