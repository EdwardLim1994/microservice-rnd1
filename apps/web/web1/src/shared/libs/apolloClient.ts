import { ApolloClient, InMemoryCache } from '@apollo/client';

// Apollo Router's supergraph gateway (see services/apollo) — reachable locally via
// `kubectl port-forward -n infra svc/apollo-router 4000:80`. Override with a PUBLIC_GRAPHQL_URL
// env var (see rsbuild.config.ts's loadEnv()) for any other environment.
const GRAPHQL_URL =
  import.meta.env.PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql';

export const apolloClient = new ApolloClient({
  uri: GRAPHQL_URL,
  cache: new InMemoryCache(),
});
