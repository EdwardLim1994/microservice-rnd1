import { createGraphqlCodegenConfig } from 'script';

export default createGraphqlCodegenConfig({
  serverName: 'Demo2',
  schema: './src/schema/graphql/demo2.graphql',
  out: '../../packages/api/src/generated/demo2/graphql',
});
