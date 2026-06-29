import type { CronRouter } from '../router';
import { BaseServer } from '../shared';

export default class CronServer extends BaseServer {
	private _controller?: CronRouter;

	public withController(controller: CronRouter): this {
		this._controller = controller;
		return this;
	}

	public override run(): Promise<void> {
		throw new Error('Method not implemented.');
	}
}
