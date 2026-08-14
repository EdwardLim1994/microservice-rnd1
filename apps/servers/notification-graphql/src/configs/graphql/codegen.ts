import { createGraphqlCodegenConfig } from "script";

export default createGraphqlCodegenConfig({
	serverName: "NotificationGraphql",
	schema: "./src/schemas/graphql/notification.graphql",
	out: "../../../packages/api/src/generated/notification-graphql/graphql",
});
