import { createGraphqlCodegenConfig } from 'script';

export default createGraphqlCodegenConfig({
  serverName: 'Demo1',
  schema: './src/schemas/graphql/demo1.graphql',
  out: '../../packages/api/src/generated/demo1/graphql',
});
