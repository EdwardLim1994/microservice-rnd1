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
// as intercept() itself.
export class AuthInterceptor extends BaseInterceptor {
  protected validateToken(token?: string): boolean {
    if (!token) return false;
    const bearerToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    return bearerToken === process.env.AUTH_TOKEN;
  }

  protected intercept(request: InterceptorRequest): void {
    if (!this.validateToken(request.getHeader('authorization'))) {
      throw new InterceptorError('Unauthenticated');
    }
  }
}
