import { Server, ServerCredentials } from '@grpc/grpc-js';
import { BaseDriver, type DriverStartOptions } from '../abstract/BaseDriver';

export class GrpcDriver extends BaseDriver {
  private readonly _server: Server;

  constructor(server?: Server) {
    super();
    this._server = server ?? new Server();
  }

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

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this._server.tryShutdown((err) => (err ? reject(err) : resolve()));
    });
  }
}
