import { BaseInterceptor, type InterceptorRequest } from "lib";

// Never rejects — just observes. Useful for confirming an interceptor is actually wired up and
// firing per request (gRPC or GraphQL, same as any BaseInterceptor), or for seeing what headers a
// client is actually sending, before reaching for something heavier like real OTel tracing.
export default class LoggingInterceptor extends BaseInterceptor {
	protected intercept(request: InterceptorRequest): void {
		// Logs presence, not the raw value — an auth token ending up in plaintext logs is exactly the
		// kind of thing this interceptor shouldn't cause.
		const hasAuth = request.getHeader("authorization") !== undefined;
		const requestId = request.getHeader("x-request-id") ?? "n/a";
		console.log(
			`intercepted request — authorization: ${hasAuth}, x-request-id: ${requestId}`,
		);
	}
}
