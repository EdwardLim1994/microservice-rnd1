import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import type NotificationRepository from "../../src/repositories/NotificationRepository";
import MarkNotificationReadUseCase from "../../src/usecases/MarkNotificationReadUseCase";

function createMockRepo(existing: Record<string, unknown> | null) {
	const marked: string[] = [];
	const repo = {
		async findById(id: string) {
			return existing?.id === id ? existing : null;
		},
		async markRead(id: string) {
			marked.push(id);
			return { ...existing, read: true };
		},
	};
	return {
		repo: repo as unknown as NotificationRepository,
		marked: () => marked,
	};
}

// [E2E-1/2 notification interaction] Marking a notification as read
test("marks an existing notification as read", async () => {
	const { repo, marked } = createMockRepo({ id: "notif-1", read: false });
	const useCase = new MarkNotificationReadUseCase({
		notificationRepository: repo,
	});

	const result = (await useCase.execute({ id: "notif-1" })) as {
		read: boolean;
	};

	expect(marked()).toEqual(["notif-1"]);
	expect(result.read).toBe(true);
});

test("non-existent notification throws a not-found GraphQLError", async () => {
	const { repo } = createMockRepo(null);
	const useCase = new MarkNotificationReadUseCase({
		notificationRepository: repo,
	});

	let thrown: unknown;
	try {
		await useCase.execute({ id: "missing" });
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(GraphQLError);
	expect(String((thrown as GraphQLError).extensions?.code)).toBe("NOT_FOUND");
});
