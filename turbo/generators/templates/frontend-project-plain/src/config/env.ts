// Rsbuild inlines env vars prefixed PUBLIC_ into client code at build time — but baking in a
// fixed hostname (even "localhost") breaks the moment this app is reached from anywhere other
// than the exact machine that built it: "localhost" only resolves on the Docker host itself, not
// from a phone/laptop hitting it over a Tailscale IP or LAN address. Apollo Router's port (4000)
// is always published on the same host as this app's own port, though, so falling back to
// whatever hostname the browser actually used to load this page — not a hardcoded one — works
// from any vantage point without needing a rebuild per network. `||`, not `??`: an unset build
// arg gets inlined as an empty string, not `undefined`, and `??` doesn't treat `''` as absent.
export const GRAPHQL_URL =
	process.env.PUBLIC_GRAPHQL_URL || `http://${globalThis.location?.hostname ?? "localhost"}:4000/graphql`;
