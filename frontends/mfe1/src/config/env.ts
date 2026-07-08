// Rsbuild inlines env vars prefixed PUBLIC_ into client code at build time.
// The browser runs on the same host as the dev stack, so localhost works
// here unlike the mobile app (which needs a device-reachable address).
export const GRAPHQL_URL = process.env.PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql';
