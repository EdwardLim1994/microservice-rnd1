import {
  asClass,
  asValue,
  createContainer,
  InjectionMode,
  Lifetime,
  type NameAndRegistrationPair,
} from 'awilix';
import type { BaseDriver } from './abstract/BaseDriver';
import type { BaseInterceptor } from './abstract/BaseInterceptor';
import type { BasePlugin } from './abstract/BasePlugin';
import type { BaseRouter } from './abstract/BaseRouter';
import type { DbAdapter } from './database/DbAdapter';

type Constructor<T> = new (...args: any[]) => T;

export interface PrismaLifecycle {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}

type PrismaClientConstructor<TClient extends PrismaLifecycle> = new (
  ...args: any[]
) => TClient;

export const singleton = <T>(Class: Constructor<T>) =>
  asClass(Class).setLifetime(Lifetime.SINGLETON);

export const transient = <T>(Class: Constructor<T>) =>
  asClass(Class).setLifetime(Lifetime.TRANSIENT);

export class ServerApp<TDriver extends BaseDriver> {
  private readonly container = createContainer({
    injectionMode: InjectionMode.PROXY,
  });
  private _routers: Constructor<BaseRouter>[] = [];
  private _interceptors: Constructor<BaseInterceptor>[] = [];
  private _plugins: Constructor<BasePlugin>[] = [];
  private _pluginInstances: BasePlugin[] = [];
  private _prismaClient?: PrismaLifecycle;
  private _dbAdapter?: DbAdapter;
  private _port = 3000;
  private _host = '0.0.0.0';

  private constructor(private readonly driver: TDriver) {
    this.container.register({ container: asValue(this.container) });
  }

  static init<TDriver extends BaseDriver>(
    Driver: Constructor<TDriver>,
  ): ServerApp<TDriver> {
    return new ServerApp(new Driver());
  }

  database<TClient extends PrismaLifecycle>(
    Client: PrismaClientConstructor<TClient>,
    dbAdapter: DbAdapter,
  ): this {
    this._dbAdapter = dbAdapter;
    this._prismaClient = new Client({ adapter: dbAdapter.adapter });
    this.container.register({ prisma: asValue(this._prismaClient) });
    return this;
  }

  containers(registrations: NameAndRegistrationPair<unknown>): this {
    this.container.register(registrations);
    return this;
  }

  routers(routers: Constructor<BaseRouter>[]): this {
    this._routers = routers;
    return this;
  }

  interceptors(interceptors: Constructor<BaseInterceptor>[]): this {
    this._interceptors = interceptors;
    return this;
  }

  plugins(plugins: Constructor<BasePlugin>[]): this {
    this._plugins = plugins;
    return this;
  }

  port(port: number): this {
    this._port = port;
    return this;
  }

  host(host: string): this {
    this._host = host;
    return this;
  }

  async run(callback?: (port: number, host: string) => void): Promise<void> {
    await this._prismaClient?.$connect();

    const routers = this._routers.map((R) => new R(this.container));
    const interceptors = this._interceptors.map((I) => new I(this.container));
    this._pluginInstances = this._plugins.map((P) => new P(this.container));

    await Promise.all(this._pluginInstances.map((p) => p.onStart()));

    await this.driver.start({
      port: this._port,
      host: this._host,
      routers,
      interceptors,
      plugins: this._pluginInstances,
    });

    callback?.(this._port, this._host);
  }

  async stop(): Promise<void> {
    await Promise.all(this._pluginInstances.map((p) => p.onStop()));
    await this.driver.stop();
    await this._prismaClient?.$disconnect();
    await this._dbAdapter?.end();
  }
}
