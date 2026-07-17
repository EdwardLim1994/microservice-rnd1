import { expect, test } from "@rstest/core";
import CreateNotificationUseCase from "../../src/usecases/CreateNotificationUseCase";
import type NotificationRepository from "../../src/repositories/NotificationRepository";

function createMockRepo() {
	const created: Record<string, unknown>[] = [];
	const repo = {
		async create(data: Record<string, unknown>) {
			const notification = { id: "notif-1", read: false, createdAt: new Date(), ...data };
			created.push(notification);
			return notification;
		},
	};
	return { repo: repo as unknown as NotificationRepository, created: () => created };
}

test("creates a notification for the given employee", async () => {
	const { repo, created } = createMockRepo();
	const useCase = new CreateNotificationUseCase({ notificationRepository: repo });

	const result = (await useCase.execute({
		input: { employeeId: "emp-1", message: "Your leave request was approved." },
	})) as { employeeId: string; message: string };

	expect(result.employeeId).toBe("emp-1");
	expect(result.message).toBe("Your leave request was approved.");
	expect(created()).toHaveLength(1);
});
