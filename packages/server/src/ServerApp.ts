import {
  asClass,
  asValue,
  createContainer,
  InjectionMode,
  Lifetime,
  type NameAndRegistrationPair,
} from 'awilix';
import type { BaseDriver, DriverStartOptions } from './abstract/BaseDriver';
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

export interface DriverReadyInfo {
  driver: string;
  port?: number;
  host?: string;
}

export interface DriverEntry {
  driver: Constructor<BaseDriver>;
  port?: number;
  host?: string;
  /**
   * Fires for this driver only, once it's started — avoids string-matching `info.driver`
   * in the shared run() callback when different drivers need different startup behavior.
   */
  onReady?: (info: DriverReadyInfo) => void;
  /**
   * Passed as the driver's sole constructor argument (new Driver(config)) — lets a driver
   * take rich typed config (e.g. KafkaDriver's brokers/topics) instead of only env vars.
   * Drivers that don't use it are unaffected: passing `undefined` still triggers their
   * constructor's own default parameters, same as calling `new Driver()`.
   */
  config?: unknown;
}

/**
 * Either a bare driver constructor (uses ServerApp's default port/host, if any)
 * or an entry with its own port/host/onReady — e.g. gRPC on 5001, GraphQL on 4001, Kafka with none.
 */
type DriverInit = Constructor<BaseDriver> | DriverEntry;

interface RunningDriver {
  driver: BaseDriver;
  port?: number;
  host?: string;
  onReady?: (info: DriverReadyInfo) => void;
}

/** Wraps a class for `.containers()` registration with one shared instance per container. */
export const singleton = <T>(Class: Constructor<T>) =>
  asClass(Class).setLifetime(Lifetime.SINGLETON);

/** Wraps a class for `.containers()` registration with a new instance per resolution. */
export const transient = <T>(Class: Constructor<T>) =>
  asClass(Class).setLifetime(Lifetime.TRANSIENT);

export class ServerApp {
  private readonly container = createContainer({
    injectionMode: InjectionMode.PROXY,
  });
  private readonly runningDrivers: RunningDriver[];
  private _routers: Constructor<BaseRouter>[] = [];
  private _interceptors: Constructor<BaseInterceptor>[] = [];
  private _plugins: Constructor<BasePlugin>[] = [];
  private _pluginInstances: BasePlugin[] = [];
  private _database?: {
    Client: PrismaClientConstructor<PrismaLifecycle>;
    dbAdapterOrFactory: DbAdapter | (() => Promise<DbAdapter>);
  };
  private _prismaClient?: PrismaLifecycle;
  private _dbAdapter?: DbAdapter;
  private _port?: number;
  private _host = '0.0.0.0';

  private constructor(drivers: DriverInit[]) {
    this.container.register({ container: asValue(this.container) });
    this.runningDrivers = drivers.map((entry) => {
      const {
        driver: Driver,
        port,
        host,
        onReady,
        config,
      } = typeof entry === 'function' ? { driver: entry } : entry;
      return { driver: new Driver(config), port, host, onReady };
    });
  }

  /** Builds a `ServerApp` from either a single bare driver or an array of driver entries. */
  static init(driver: Constructor<BaseDriver>): ServerApp;
  static init(drivers: DriverInit[]): ServerApp;
  static init(drivers: Constructor<BaseDriver> | DriverInit[]): ServerApp {
    return new ServerApp(Array.isArray(drivers) ? drivers : [drivers]);
  }

  /**
   * Registers the Prisma client class + adapter (or async adapter factory) — resolved inside
   * `run()`, before plugins start, since a factory (e.g. `VaultPgAdapter.fromEnv()`) needs an
   * awaited round-trip that can't happen synchronously here.
   */
  database<TClient extends PrismaLifecycle>(
    Client: PrismaClientConstructor<TClient>,
    dbAdapter: DbAdapter | (() => Promise<DbAdapter>),
  ): this {
    this._database = {
      Client: Client as PrismaClientConstructor<PrismaLifecycle>,
      dbAdapterOrFactory: dbAdapter,
    };
    return this;
  }

  /** Registers additional DI entries (e.g. repositories) into the shared awilix container. */
  containers(registrations: NameAndRegistrationPair<unknown>): this {
    this.container.register(registrations);
    return this;
  }

  /** Sets the routers every driver shares. */
  routers(routers: Constructor<BaseRouter>[]): this {
    this._routers = routers;
    return this;
  }

  /** Sets the request-level interceptors applied across drivers. */
  interceptors(interceptors: Constructor<BaseInterceptor>[]): this {
    this._interceptors = interceptors;
    return this;
  }

  /** Sets the server-level plugins started/stopped alongside the drivers. */
  plugins(plugins: Constructor<BasePlugin>[]): this {
    this._plugins = plugins;
    return this;
  }

  /** Fallback port for driver entries that don't specify their own. */
  port(port: number): this {
    this._port = port;
    return this;
  }

  /** Fallback host for driver entries that don't specify their own. */
  host(host: string): this {
    this._host = host;
    return this;
  }

  /**
   * Resolves the DB adapter (if any), constructs routers/interceptors/plugins, starts every
   * plugin then every driver in parallel, firing each driver's own `onReady` plus the shared
   * `callback` once it's up.
   */
  async run(callback?: (info: DriverReadyInfo) => void): Promise<void> {
    if (this._database) {
      const { Client, dbAdapterOrFactory } = this._database;
      const dbAdapter =
        typeof dbAdapterOrFactory === 'function'
          ? await dbAdapterOrFactory()
          : dbAdapterOrFactory;
      this._dbAdapter = dbAdapter;
      this._prismaClient = new Client({ adapter: dbAdapter.adapter });
      this.container.register({ prisma: asValue(this._prismaClient) });
    }

    await this._prismaClient?.$connect();

    const routers = this._routers.map((R) => new R(this.container));
    const interceptors = this._interceptors.map((I) => new I(this.container));
    this._pluginInstances = this._plugins.map((P) => new P(this.container));

    await Promise.all(this._pluginInstances.map((p) => p.onStart()));

    await Promise.all(
      this.runningDrivers.map(async (entry) => {
        const options: DriverStartOptions = {
          port: entry.port ?? this._port ?? 3000,
          host: entry.host ?? this._host,
          routers,
          interceptors,
          plugins: this._pluginInstances,
          container: this.container,
        };
        await entry.driver.start(options);

        const info: DriverReadyInfo = {
          driver: entry.driver.constructor.name,
          port: entry.port ?? this._port,
          host: entry.host ?? this._host,
        };
        entry.onReady?.(info);
        callback?.(info);
      }),
    );
  }

  /** Stops plugins then drivers (reverse of `run()`'s start order), then closes the DB connection. */
  async stop(): Promise<void> {
    await Promise.all(this._pluginInstances.map((p) => p.onStop()));
    await Promise.all(this.runningDrivers.map((entry) => entry.driver.stop()));
    await this._prismaClient?.$disconnect();
    await this._dbAdapter?.end();
  }
}
