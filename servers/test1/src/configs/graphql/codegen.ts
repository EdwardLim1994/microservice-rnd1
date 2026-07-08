import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "Test1",
	schema: "./src/schemas/graphql/test1.graphql",
	out: "../../packages/api/src/generated/test1/graphql",
});
