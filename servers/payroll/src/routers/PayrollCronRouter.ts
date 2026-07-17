import { type CronHandlerMap, CronRouter } from "server";
import MonthlyPayslipCronUseCase from "../usecases/MonthlyPayslipCronUseCase";

const schedules = { generatePayslips: "0 0 1 * *" }; // 00:00 UTC on the 1st of every month

export default class PayrollCronRouter extends CronRouter<typeof schedules> {
	get schedules() {
		return schedules;
	}

	get handlers(): CronHandlerMap<typeof schedules> {
		return { generatePayslips: MonthlyPayslipCronUseCase };
	}
}
