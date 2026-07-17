import { PayrollGraphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import CreateNotificationUseCase from "../usecases/CreateNotificationUseCase";
import GeneratePayslipsUseCase from "../usecases/GeneratePayslipsUseCase";
import GetPayslipURLUseCase from "../usecases/GetPayslipURLUseCase";
import ListNotificationsUseCase from "../usecases/ListNotificationsUseCase";
import MarkNotificationReadUseCase from "../usecases/MarkNotificationReadUseCase";
import ResolveNotificationEmployeeUseCase from "../usecases/ResolveNotificationEmployeeUseCase";
import ResolveNotificationReferenceUseCase from "../usecases/ResolveNotificationReferenceUseCase";
import ResolvePayslipEmployeeUseCase from "../usecases/ResolvePayslipEmployeeUseCase";
import ResolvePayslipReferenceUseCase from "../usecases/ResolvePayslipReferenceUseCase";

export default class PayrollGraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return PayrollGraphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Query: {
				notifications: ListNotificationsUseCase,
				payslipDownloadURL: GetPayslipURLUseCase,
			},
			Mutation: {
				generatePayslips: GeneratePayslipsUseCase,
				markNotificationRead: MarkNotificationReadUseCase,
				createNotification: CreateNotificationUseCase,
			},
			Payslip: {
				__resolveReference: ResolvePayslipReferenceUseCase,
				employee: ResolvePayslipEmployeeUseCase,
			},
			Notification: {
				__resolveReference: ResolveNotificationReferenceUseCase,
				employee: ResolveNotificationEmployeeUseCase,
			},
		};
	}
}
