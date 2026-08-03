import type {
  handleUnaryCall,
  Server,
  ServerUnaryCall,
  ServiceDefinition,
  sendUnaryData,
  UntypedServiceImplementation,
} from '@grpc/grpc-js';
import { type AwilixContainer, asClass } from 'awilix';
import { BaseRouter } from '../abstract/BaseRouter';
import type { BaseUseCase } from '../abstract/BaseUseCase';
import type { Registrable } from '../abstract/Registrable';
import { withServerSpan } from '../otel-span';

type ExtractReq<T> = T extends handleUnaryCall<infer Req, any> ? Req : never;
type ExtractRes<T> = T extends handleUnaryCall<any, infer Res> ? Res : never;

export type GrpcHandlerMap<TService> = {
  [K in keyof TService]: new (
    ...args: any[]
  ) => BaseUseCase<ExtractReq<TService[K]>, ExtractRes<TService[K]>>;
};

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export abstract class GrpcRouter<TService>
  extends BaseRouter
  implements Registrable
{
  constructor(protected readonly container: AwilixContainer) {
    super();
  }

  /** The generated `*Service` const (not the `*Server` interface) describing this gRPC service. */
  abstract get service(): ServiceDefinition<TService>;
  /** Maps each service method to the use case that handles it. */
  abstract get handlers(): GrpcHandlerMap<TService>;

  /** Auto-registers each handler's use case into the container (if not already), then adds the service to the gRPC server. */
  register(server: unknown): void {
    const grpcServer = server as Server;

    for (const UseCase of Object.values(this.handlers)) {
      const token = lcFirst((UseCase as any).name);
      if (!this.container.hasRegistration(token)) {
        this.container.register({
          [token]: asClass(UseCase as any).transient(),
        });
      }
    }

    grpcServer.addService(this.service, this._buildImpl());
  }

  /** Builds the gRPC service implementation, resolving and invoking each method's use case from the container per call. */
  private _buildImpl(): UntypedServiceImplementation {
    return Object.fromEntries(
      Object.entries(this.handlers).map(([method, UseCase]) => {
        const token = lcFirst((UseCase as any).name);
        return [
          method,
          async (
            call: ServerUnaryCall<any, any>,
            callback: sendUnaryData<any>,
          ) => {
            try {
              const result = await withServerSpan(
                this.container,
                `grpc.${method}`,
                () => {
                  const useCase =
                    this.container.resolve<BaseUseCase<any, any>>(token);
                  return useCase.execute(call.request);
                },
              );
              callback(null, result);
            } catch (err) {
              callback(err as Error);
            }
          },
        ];
      }),
    );
  }
}
