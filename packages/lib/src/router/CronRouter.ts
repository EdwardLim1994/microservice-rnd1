import type { CronJob, CronWithAutocomplete } from "bun";
import { BaseRouter } from "../shared";

export type CronTask = {
	schedule: CronWithAutocomplete;
	handler: (this: CronJob) => unknown;
};
export default abstract class CronRouter extends BaseRouter {
	public abstract implementation(): Map<string, CronTask>;
	public register(): Map<string, CronTask> {
		return this.implementation();
	}
}
