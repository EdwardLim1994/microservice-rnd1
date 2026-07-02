import { type CronHandlerMap, CronRouter } from "lib";
import { LogHeartbeatUseCase } from "../usecases/";

const schedules = { heartbeat: "* * * * *" }; // every minute, UTC

export default class DemoCronRouter extends CronRouter<typeof schedules> {
	get schedules() {
		return schedules;
	}
	get handlers(): CronHandlerMap<typeof schedules> {
		return { heartbeat: LogHeartbeatUseCase };
	}
}
