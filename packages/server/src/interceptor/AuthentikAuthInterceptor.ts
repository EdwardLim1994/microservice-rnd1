import {
  createRemoteJWKSet,
  type JWTVerifyOptions,
  type JWTVerifyResult,
  jwtVerify,
} from 'jose';
import { AuthInterceptor } from './AuthInterceptor';

type Verify = (
  token: string,
  jwks: ReturnType<typeof createRemoteJWKSet>,
  options: JWTVerifyOptions,
) => Promise<JWTVerifyResult>;

// Validates a Bearer token by verifying its signature against servers/auth's Authentik-issued
// JWKS — the real validator the AuthInterceptor docstring's "swap in real auth later" comment
// points at, once servers/auth (see its own CLAUDE.md) exists. No shared secret to distribute:
// the OAuth2 Provider signs with RS256 (services/authentik/ansible's provisioning role sets
// `signing_key` to Authentik's default self-signed CertificateKeyPair — HS256, the default with
// no signing_key set, would need every consuming server to hold the provider's client_secret,
// which doesn't scale past one consumer and isn't a real per-server credential to begin with).
// Any server can fetch the public JWKS and verify independently.
//
// ServerApp always constructs interceptors as `new I(container)` (see ServerApp.run()) — the
// first constructor param below exists only to occupy that position; this class has nothing to
// register into the container, same as AuthInterceptor itself. `verify` is the real injectable
// seam (defaults to jose's own jwtVerify), same testability pattern as RedisPlugin/
// MeilisearchPlugin's `createClient` factory param — tests inject a mock instead of hitting a
// real network JWKS endpoint.
export class AuthentikAuthInterceptor extends AuthInterceptor {
  private readonly issuer: string;
  private readonly audience?: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  /** Resolves issuer/audience from `AUTHENTIK_URL`/`AUTHENTIK_APPLICATION_SLUG`/`AUTHENTIK_JWT_AUDIENCE` and builds the remote JWKS; throws if `AUTHENTIK_URL` is missing. */
  constructor(
    _container?: unknown,
    private readonly verify: Verify = jwtVerify,
  ) {
    super();
    const authentikUrl = (process.env.AUTHENTIK_URL ?? '').replace(/\/$/, '');
    if (!authentikUrl) {
      throw new Error('AuthentikAuthInterceptor requires AUTHENTIK_URL');
    }
    // servers/auth's own Application slug (services/authentik/ansible's application_slug default
    // — see that role and servers/auth/ansible/vars.yml) — overridable since a deployment could
    // rename it, but "auth" covers this repo's only token-issuing server today.
    const applicationSlug = process.env.AUTHENTIK_APPLICATION_SLUG ?? 'auth';
    this.issuer = `${authentikUrl}/application/o/${applicationSlug}/`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}jwks/`));
    // Unset by default: this repo's provisioning issues tokens scoped to one OAuth2 client
    // (servers/auth's own), so every consuming server would otherwise need to know that client_id
    // just to check `aud`. Set AUTHENTIK_JWT_AUDIENCE to enforce it once that's a real requirement
    // (e.g. multiple distinct token-issuing clients sharing one Authentik instance).
    this.audience = process.env.AUTHENTIK_JWT_AUDIENCE;
  }

  /** Verifies a Bearer token's signature/issuer/audience against Authentik's JWKS — returns false (not the specific reason) on any failure. */
  protected async validateToken(token?: string): Promise<boolean> {
    if (!token) return false;
    const bearerToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    try {
      await this.verify(bearerToken, this.jwks, {
        issuer: this.issuer,
        ...(this.audience ? { audience: this.audience } : {}),
      });
      return true;
    } catch {
      // Expired, malformed, wrong issuer/audience, or signed by a key not in the JWKS — jose
      // throws a distinct error subclass for each, but this interceptor only has a binary
      // accept/reject signal to give BaseInterceptor, same as AuthInterceptor's own static
      // comparison. A caller wanting the specific reason should inspect the token/logs directly.
      return false;
    }
  }
}
