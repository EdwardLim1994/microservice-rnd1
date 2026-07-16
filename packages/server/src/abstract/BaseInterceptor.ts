import type { ApolloServer, ApolloServerPlugin } from '@apollo/server';
import {
  type Server as GrpcServer,
  type ServerUnaryCall,
  status,
  type UntypedHandleCall,
  type UntypedServiceImplementation,
} from '@grpc/grpc-js';
import { GraphQLError } from 'graphql';

export interface InterceptorRequest {
  getHeader(name: string): string | undefined;
}

/**
 * Throw this from intercept() to reject the call — translated into the right shape for whichever
 * protocol is calling it (grpc `status.UNAUTHENTICATED` / GraphQL `extensions.code:
 * 'UNAUTHENTICATED'`). Any other thrown error still rejects the call (as an internal/unformatted
 * error instead) — this class exists so a deliberate rejection looks distinct from an unexpected bug.
 */
export class InterceptorError extends Error {}

type UnaryCallback = (error: unknown, ...rest: unknown[]) => void;

export abstract class BaseInterceptor {
  /**
   * Called once per request, given a protocol-agnostic view of the incoming call — the same hook
   * regardless of whether this interceptor ends up wired to gRPC or GraphQL. Throw an
   * InterceptorError to reject the call (e.g. an auth failure); return normally to let it continue
   * — a logging/OTel interceptor, for instance, would just read headers here and never throw.
   */
  protected abstract intercept(
    request: InterceptorRequest,
  ): void | Promise<void>;

  /**
   * Called once at startup (not per request) with whichever raw driver server this ServerApp is
   * running — duck-typed since there's no shared "middleware" shape across gRPC/GraphQL to
   * type-check against instead (same technique as ApolloDriver's isGraphqlRouter /
   * KafkaDriver's isKafkaConsumerRouter). Wires this interceptor's `intercept()` into whichever
   * protocol it recognizes.
   */
  apply(server: unknown): void {
    if (this.isGrpcServer(server)) {
      this.applyToGrpc(server);
      return;
    }
    if (this.isApolloServer(server)) {
      this.applyToApollo(server);
    }
  }

  /** Duck-types `server` as a `@grpc/grpc-js` `Server` (has `addService`). */
  protected isGrpcServer(server: unknown): server is GrpcServer {
    return (
      typeof server === 'object' &&
      server !== null &&
      typeof (server as GrpcServer).addService === 'function'
    );
  }

  /** Duck-types `server` as an `ApolloServer` (has `addPlugin`). */
  protected isApolloServer(server: unknown): server is ApolloServer {
    return (
      typeof server === 'object' &&
      server !== null &&
      typeof (server as ApolloServer).addPlugin === 'function'
    );
  }

  /**
   * @grpc/grpc-js only supports server interceptors via `new Server({ interceptors })` at
   * construction time — but GrpcDriver already constructs its Server before apply() runs, so
   * there's no supported post-construction hook. Wraps the public addService() instead, so every
   * router's later register() call (which calls addService()) transparently goes through
   * intercept() first.
   */
  private applyToGrpc(server: GrpcServer): void {
    const originalAddService = server.addService.bind(server);
    server.addService = (service, implementation) => {
      originalAddService(service, this.wrapGrpcImplementation(implementation));
    };
  }

  /** Wraps every method on a gRPC service implementation with `wrapGrpcHandler`. */
  private wrapGrpcImplementation(
    implementation: UntypedServiceImplementation,
  ): UntypedServiceImplementation {
    return Object.fromEntries(
      Object.entries(implementation).map(([method, handler]) => [
        method,
        this.wrapGrpcHandler(handler),
      ]),
    );
  }

  /** Runs `intercept()` before delegating to `handler`, translating a thrown `InterceptorError` into `status.UNAUTHENTICATED` (any other error into `status.INTERNAL`). */
  private wrapGrpcHandler(handler: UntypedHandleCall): UntypedHandleCall {
    // Only unary/client-streaming calls take a callback as the 2nd arg (server-streaming/bidi
    // handlers take just `call` and write to the stream directly) — GrpcRouter, this framework's
    // only producer of gRPC handlers, only ever builds handleUnaryCall today, so a handler with no
    // callback param is passed through unwrapped rather than guessing at how to reject a stream.
    if (handler.length < 2) return handler;

    return (async (
      call: ServerUnaryCall<unknown, unknown>,
      callback: UnaryCallback,
    ) => {
      try {
        await this.intercept({
          getHeader: (name) => {
            const [value] = call.metadata.get(name);
            return value === undefined ? undefined : String(value);
          },
        });
      } catch (err) {
        callback({
          code:
            err instanceof InterceptorError
              ? status.UNAUTHENTICATED
              : status.INTERNAL,
          message:
            err instanceof Error ? err.message : 'Rejected by interceptor',
        });
        return;
      }
      (handler as (...args: unknown[]) => void)(call, callback);
    }) as UntypedHandleCall;
  }

  /**
   * ApolloServer.addPlugin() is a stable, public extension point (unlike gRPC, no monkey-patching
   * needed) — didResolveOperation runs after parsing/validation but before any resolver executes.
   * Translates a thrown `InterceptorError` into a `GraphQLError` with `extensions.code:
   * 'UNAUTHENTICATED'`.
   */
  private applyToApollo(server: ApolloServer): void {
    const plugin: ApolloServerPlugin = {
      requestDidStart: async () => ({
        didResolveOperation: async (requestContext) => {
          try {
            await this.intercept({
              getHeader: (name) =>
                requestContext.request.http?.headers.get(name) ?? undefined,
            });
          } catch (err) {
            if (err instanceof InterceptorError) {
              throw new GraphQLError(err.message, {
                extensions: { code: 'UNAUTHENTICATED' },
              });
            }
            throw err;
          }
        },
      }),
    };
    server.addPlugin(plugin);
  }
}
