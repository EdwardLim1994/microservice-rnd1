import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "Auth",
	schema: "./src/schemas/graphql/auth.graphql",
	out: "../../packages/api/src/generated/auth/graphql",
});
