import { asClass, createContainer, Lifetime } from 'awilix';
import { isEmpty } from 'lodash';
import type { BaseAdapter, BaseDatabase, BaseServer } from '../shared';

export default class App {
	private _sidecar?: BaseServer;
	private readonly _adapters: Map<
		string,
		new (
			...args: unknown[]
		) => BaseAdapter
	> = new Map();
	private _database?: BaseDatabase;

	private readonly _container = createContainer();

	private constructor(private readonly _server: BaseServer) {}

	public static init(server: BaseServer) {
		return new App(server);
	}

	public sidecar(sidecar: BaseServer) {
		this._sidecar = sidecar;
		return this;
	}

	public database(database: BaseDatabase) {
		this._database = database;
		return this;
	}

	public adapters(adapters: (new (...args: unknown[]) => BaseAdapter)[]) {
		for (const AdapterClass of adapters) {
			this._adapters.set(AdapterClass.name, AdapterClass);
		}
		return this;
	}

	public async run() {
		// Initiate database if exists
		if (this._database) {
			await this.registerDatabase(this._database);
		}

		// Initiate adapters if exists
		if (!isEmpty(this._adapters)) {
			this.registerAllAdaptersIntoContainer(this._adapters);
		}

		try {
			// Run main server
			await this._server.run();

			// Run sidecar server if exists
			if (this._sidecar) this._sidecar.run();
		} catch (err: unknown) {
			throw new Error(`Failed to run the application: ${err}`);
		}
	}

	private async registerDatabase(database: BaseDatabase) {}

	private registerAllAdaptersIntoContainer(
		adapters: Map<string, new (...args: unknown[]) => BaseAdapter>,
	) {
		for (const [name, AdapterClass] of adapters) {
			this._container.register({
				[name]: asClass(AdapterClass, { lifetime: Lifetime.SINGLETON }),
			});
		}
	}
}
