// Expo inlines env vars prefixed EXPO_PUBLIC_ into the client bundle at build time.
// Defaults to the host machine's Apollo Router — override for device/tunnel testing,
// where the device can't reach the host's `localhost` (see .env.sample).
export const GRAPHQL_URL =
  process.env.EXPO_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql';
