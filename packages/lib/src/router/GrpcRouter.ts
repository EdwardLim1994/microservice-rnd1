import type {
	Server,
	ServiceDefinition,
	UntypedServiceImplementation,
} from '@grpc/grpc-js';
import { BaseRouter } from '../shared';

export default abstract class GrpcRouter<
	T extends UntypedServiceImplementation,
> extends BaseRouter {
	protected _server?: Server;
	constructor(protected readonly service: ServiceDefinition<T>) {
		super();
	}

	protected abstract implementation(): T;

	public server(server: Server) {
		this._server = server;
		return this;
	}

	public override register() {
		try {
			this._server?.addService(this.service, this.implementation());
		} catch {
			throw new Error(
				'Server is not initialized. Please call server() method before register().',
			);
		}
	}
}
