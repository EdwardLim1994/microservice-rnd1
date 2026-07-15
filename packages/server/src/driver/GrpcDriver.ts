import { Server, ServerCredentials } from '@grpc/grpc-js';
import { BaseDriver, type DriverStartOptions } from '../abstract/BaseDriver';
import { isRegistrable } from '../abstract/Registrable';

export class GrpcDriver extends BaseDriver {
  private readonly _server: Server;

  constructor(server?: Server) {
    super();
    this._server = server ?? new Server();
  }

  /** Applies interceptors, registers every gRPC-registrable router, then binds and starts the server insecurely on `host:port`. */
  async start({
    port,
    host,
    routers,
    interceptors,
  }: DriverStartOptions): Promise<void> {
    for (const interceptor of interceptors) {
      interceptor.apply(this._server);
    }

    for (const router of routers) {
      if (!isRegistrable(router)) continue;
      router.register(this._server);
    }

    await new Promise<void>((resolve, reject) => {
      this._server.bindAsync(
        `${host}:${port}`,
        ServerCredentials.createInsecure(),
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  /** Gracefully shuts down the gRPC server, waiting for in-flight calls to finish. */
  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this._server.tryShutdown((err) => (err ? reject(err) : resolve()));
    });
  }
}
