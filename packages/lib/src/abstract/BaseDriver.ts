import type { BaseInterceptor } from './BaseInterceptor';
import type { BasePlugin } from './BasePlugin';
import type { BaseRouter } from './BaseRouter';

export interface DriverStartOptions {
  port: number;
  host: string;
  routers: BaseRouter[];
  interceptors: BaseInterceptor[];
  plugins: BasePlugin[];
}

export abstract class BaseDriver {
  abstract start(options: DriverStartOptions): Promise<void>;
  abstract stop(): Promise<void>;
}
