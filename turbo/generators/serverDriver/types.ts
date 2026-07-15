import type { PlopTypes } from "@turbo/gen";

/**
 * One entry in the unified "extension" generator's driver choices. `driverName` is the
 * export name matched against a server's src/app.ts (e.g. "GrpcDriver") to tell whether it's
 * already installed there — see helpers.ts's serverHasDriver.
 */
export interface ServerDriverExtension {
	value: string;
	label: string;
	driverName: string;
	registerActionTypes(plop: PlopTypes.NodePlopAPI): void;
	actions: PlopTypes.ActionType[];
	// Prompts specific to this driver (e.g. Kafka's producer/consumer/both role) — each should
	// carry its own `when: (answers) => answers.driver === "<value>"` so it's only asked once
	// this extension has actually been chosen.
	extraPrompts?: PlopTypes.PromptQuestion[];
}
