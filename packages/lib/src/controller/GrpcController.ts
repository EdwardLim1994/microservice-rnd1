import type {
	Server,
	ServiceDefinition,
	UntypedServiceImplementation,
} from '@grpc/grpc-js';
import { BaseController } from '../shared';

export default abstract class GrpcController<
	T extends UntypedServiceImplementation,
> extends BaseController {
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
