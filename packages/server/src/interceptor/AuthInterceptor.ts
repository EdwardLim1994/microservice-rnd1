import {
  BaseInterceptor,
  InterceptorError,
  type InterceptorRequest,
} from '../abstract/BaseInterceptor';

// All the gRPC/GraphQL wiring lives on BaseInterceptor — this only implements the one hook it
// asks for, no constructor needed. No real auth service exists yet — validateToken() just checks
// a static AUTH_TOKEN env var. Swap in real auth later by subclassing and overriding
// validateToken() (e.g. `class RealAuthInterceptor extends AuthInterceptor { protected async
// validateToken(token) { return callRealAuthService(token); } }`) — same override-one-method story
// as intercept() itself. validateToken()'s return type is `boolean | Promise<boolean>` (not just
// `boolean`) specifically so that override pattern typechecks — a subclass validating against a
// real network call (e.g. AuthentikAuthInterceptor's JWKS verification) needs to be async.
export class AuthInterceptor extends BaseInterceptor {
  protected validateToken(token?: string): boolean | Promise<boolean> {
    if (!token) return false;
    const bearerToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    return bearerToken === process.env.AUTH_TOKEN;
  }

  protected async intercept(request: InterceptorRequest): Promise<void> {
    if (!(await this.validateToken(request.getHeader('authorization')))) {
      throw new InterceptorError('Unauthenticated');
    }
  }
}
