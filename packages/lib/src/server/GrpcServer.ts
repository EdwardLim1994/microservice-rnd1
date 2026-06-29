import {
	Server,
	ServerCredentials,
	type UntypedServiceImplementation,
} from '@grpc/grpc-js';
import { isEmpty } from 'lodash';
import type { GrpcRouter } from '../router';
import { BaseServer } from '../shared';

type GrpcServerOptions = {
	port: number;
	host?: string;
	name?: string;
	credential?: ServerCredentials;
};

export default class GrpcServer extends BaseServer {
	protected credential: ServerCredentials = ServerCredentials.createInsecure();
	private callback?: () => void;
	private readonly controllers: GrpcRouter<UntypedServiceImplementation>[] = [];

	private readonly _server: Server = new Server();

	constructor({ port, host, name, credential }: GrpcServerOptions) {
		super();
		this.port = port;

		this.host = host ? this.host : '0.0.0.0';

		if (name) this.name = name;
		if (credential) this.credential = credential;
	}

	public withCallback(callback: () => void) {
		this.callback = callback;
		return this;
	}

	public withController(controller: GrpcRouter<UntypedServiceImplementation>) {
		this.controllers.push(controller);

		return this;
	}

	public override async run() {
		if (!isEmpty(this.controllers)) {
			for (const controller of this.controllers) {
				controller.server(this._server).register();
			}
		}

		this._server.bindAsync(
			this.prepareHost(),
			this.credential,
			this.runCallback(),
		);
	}

	private prepareHost() {
		return `${this.host}:${this.port}`;
	}

	private runCallback() {
		if (this.callback) {
			return this.callback;
		}

		return () => {
			console.log(`gRPC server ${this.name} is running in port ${this.port}`);
		};
	}
}
