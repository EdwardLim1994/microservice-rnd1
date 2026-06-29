import type { CronController } from '../controller';
import { BaseServer } from '../shared';

export default class CronServer extends BaseServer {
	private _controller?: CronController;

	public withController(controller: CronController): this {
		this._controller = controller;
		return this;
	}

	public override run(): Promise<void> {
		throw new Error('Method not implemented.');
	}
}
