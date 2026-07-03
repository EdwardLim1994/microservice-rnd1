import { BaseDriver, type DriverStartOptions } from "../abstract/BaseDriver";

interface CronRouterShape {
	schedules: Record<string, string>;
	dispatchers: Record<string, () => Promise<void>>;
}

export interface CronDriverConfig {
	// Bun.cron matches setTimeout error semantics: an uncaught throw/rejection from a job would
	// otherwise emit uncaughtException/unhandledRejection and, without a listener, exit the whole
	// process — not acceptable for a single bad job run in a multi-driver server. Defaults to
	// console.error so a failure is visible but doesn't take the server down.
	onError?: (error: unknown, name: string) => void;
}

export class CronDriver extends BaseDriver {
	private jobs: Bun.CronJob[] = [];

	// ponytail: factory param allows injection in tests without touching Bun's real scheduler
	constructor(
		private readonly config: CronDriverConfig = {},
		private readonly createCron: (
			schedule: string,
			handler: () => unknown,
		) => Bun.CronJob = (schedule, handler) => Bun.cron(schedule, handler),
	) {
		super();
	}

	async start({ routers }: DriverStartOptions): Promise<void> {
		const onError =
			this.config.onError ??
			((error: unknown, name: string) =>
				console.error(`[CronDriver] job "${name}" failed:`, error));

		for (const router of routers) {
			if (!this.isCronRouter(router)) continue;

			for (const [name, schedule] of Object.entries(router.schedules)) {
				const dispatch = router.dispatchers[name];
				if (!dispatch) continue;

				this.jobs.push(
					this.createCron(schedule, async () => {
						try {
							await dispatch();
						} catch (error) {
							onError(error, name);
						}
					}),
				);
			}
		}
	}

	async stop(): Promise<void> {
		for (const job of this.jobs) job.stop();
		this.jobs = [];
	}

	private isCronRouter(router: unknown): router is CronRouterShape {
		return (
			typeof router === "object" &&
			router !== null &&
			"schedules" in router &&
			"dispatchers" in router
		);
	}
}
