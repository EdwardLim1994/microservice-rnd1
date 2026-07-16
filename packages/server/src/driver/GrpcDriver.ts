import { Server, ServerCredentials } from '@grpc/grpc-js';
import { BaseDriver, type DriverStartOptions } from '../abstract/BaseDriver';
import { isRegistrable } from '../abstract/Registrable';
import type { TlsConfig } from '../database/VaultTlsAdapter';

export interface GrpcDriverConfig {
  /** When set, binds with mTLS (ServerCredentials.createSsl, requiring a verified client cert) instead of createInsecure(). */
  tls?: TlsConfig;
}

export class GrpcDriver extends BaseDriver {
  private readonly _server: Server;

  // ponytail: server param allows injection in tests without module mocking
  constructor(
    private readonly config: GrpcDriverConfig = {},
    server?: Server,
  ) {
    super();
    this._server = server ?? new Server();
  }

  /** Applies interceptors, registers every gRPC-registrable router, then binds and starts the server on `host:port` — mTLS if `config.tls` is set, insecure otherwise. */
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

    const { tls } = this.config;
    const credentials = tls
      ? ServerCredentials.createSsl(
          tls.ca,
          [{ cert_chain: tls.cert, private_key: tls.key }],
          true, // require + verify the client's certificate (mTLS)
        )
      : ServerCredentials.createInsecure();

    await new Promise<void>((resolve, reject) => {
      this._server.bindAsync(`${host}:${port}`, credentials, (err) =>
        err ? reject(err) : resolve(),
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
