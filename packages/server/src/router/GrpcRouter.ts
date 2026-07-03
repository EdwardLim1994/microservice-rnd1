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

type ExtractReq<T> = T extends handleUnaryCall<infer Req, any> ? Req : never;
type ExtractRes<T> = T extends handleUnaryCall<any, infer Res> ? Res : never;

export type GrpcHandlerMap<TService> = {
  [K in keyof TService]: new (
    ...args: any[]
  ) => BaseUseCase<ExtractReq<TService[K]>, ExtractRes<TService[K]>>;
};

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export abstract class GrpcRouter<TService> extends BaseRouter {
  constructor(protected readonly container: AwilixContainer) {
    super();
  }

  abstract get service(): ServiceDefinition<TService>;
  abstract get handlers(): GrpcHandlerMap<TService>;

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
              const useCase =
                this.container.resolve<BaseUseCase<any, any>>(token);
              const result = await useCase.execute(call.request);
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
