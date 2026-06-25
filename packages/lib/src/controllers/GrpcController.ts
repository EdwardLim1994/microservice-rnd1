import type { Server, ServiceDefinition, UntypedServiceImplementation } from "@grpc/grpc-js"

export default abstract class GrpcController<T extends UntypedServiceImplementation> {

  constructor(protected readonly service: ServiceDefinition<T>) { }

  protected abstract implementation(): T;

  public register(server: Server) {
    server.addService(this.service, this.implementation())
  }
}
