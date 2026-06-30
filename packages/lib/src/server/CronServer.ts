import type { CronJob } from "bun";
import type { CronRouter } from "../router";
import type { CronTask } from "../router/CronRouter";
import { BaseServer } from "../shared";

export default class CronServer extends BaseServer {
	private _router?: CronRouter;
	private readonly _runningTasks: Map<string, CronJob> = new Map();

	public withRouter(router: CronRouter): this {
		this._router = router;
		return this;
	}

	public override async run(): Promise<void> {
		if (!this._router) throw new Error("CronRouter is required");

		const tasks: Map<string, CronTask> = this._router.register();

		tasks.forEach((task, key) => {
			const job = Bun.cron(task.schedule, task.handler);
			this._runningTasks.set(key, job);
		});
	}
}
