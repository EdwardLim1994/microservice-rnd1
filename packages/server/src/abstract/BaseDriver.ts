import type { AwilixContainer } from 'awilix';
import type { BaseInterceptor } from './BaseInterceptor';
import type { BasePlugin } from './BasePlugin';
import type { BaseRouter } from './BaseRouter';

export interface DriverStartOptions {
  port: number;
  host: string;
  routers: BaseRouter[];
  interceptors: BaseInterceptor[];
  plugins: BasePlugin[];
  container: AwilixContainer;
}

export abstract class BaseDriver {
  /** Starts this driver's protocol server against the shared routers/interceptors/plugins/container. */
  abstract start(options: DriverStartOptions): Promise<void>;
  /** Stops this driver's protocol server. */
  abstract stop(): Promise<void>;
}
