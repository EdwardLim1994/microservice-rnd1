import type { PlopTypes } from "@turbo/gen";
import {
	findServerWorkspaces,
	serverHasDriver,
	workspaceChoices,
} from "../helpers";
import CronGenerator from "./CronGenerator";
import GraphqlGenerator from "./GraphqlGenerator";
import GrpcGenerator from "./GrpcGenerator";
import KafkaGenerator from "./KafkaGenerator";
import type { ServerDriverExtension } from "./types";

const EXTENSIONS: ServerDriverExtension[] = [
	GrpcGenerator,
	GraphqlGenerator,
	KafkaGenerator,
	CronGenerator,
];

// Extensions not yet installed on `location` — both what the "driver" prompt offers
// interactively and what a non-interactive `--args` invocation is validated against.
function availableExtensions(
	root: string,
	location: string,
): ServerDriverExtension[] {
	return EXTENSIONS.filter(
		(extension) => !serverHasDriver(root, location, extension.driverName),
	);
}

export default class ServerDriverGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		for (const extension of EXTENSIONS) {
			extension.registerActionTypes(plop);
		}

		const root = process.cwd();
		// Only servers with at least one extension left to add — one already fully wired up
		// (gRPC + GraphQL + Kafka + Cron) has nothing left for this generator to offer.
		const eligibleServers = findServerWorkspaces(root).filter(
			(location) => availableExtensions(root, location).length > 0,
		);

		plop.setGenerator("driver", {
			description:
				"Add a protocol driver extension (gRPC, GraphQL Federation, Kafka, or Cron) to an existing server — only offers extensions not already installed on the chosen server",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target server:",
					choices: workspaceChoices(
						eligibleServers,
						"No server workspaces with an available extension found under servers/**",
					),
				},
				{
					type: "list",
					name: "driver",
					message: "Which extension to add?",
					// Must be a function, not a static array: Inquirer's "list" prompt never
					// invokes `validate` (that only applies to free-text prompt types), so
					// filtering happens here, computed per chosen `location`, or an
					// already-installed extension would still be selectable. This does mean
					// `turbo gen driver --args <location> <driver>` no longer works (turbo's own
					// arg-matching assumes a static choices array and errors on a function) —
					// acceptable since interactive selection (`turbo gen driver`) is the only
					// documented entry point (see package.json's "generate": "turbo gen").
					choices: (answers: { location: string }) => {
						const available = availableExtensions(root, answers.location);
						return available.length > 0
							? available.map((extension) => ({ name: extension.label, value: extension.value }))
							: [
									{
										name: "All extensions already installed on this server",
										value: "",
										disabled: true,
									},
								];
					},
				},
				...EXTENSIONS.flatMap((extension) => extension.extraPrompts ?? []),
			],
			actions: (answers) => {
				const { driver } = answers as { driver: string };
				const extension = EXTENSIONS.find(
					(candidate) => candidate.value === driver,
				);
				if (!extension) {
					throw new Error(`Unknown extension "${driver}"`);
				}
				return extension.actions;
			},
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new ServerDriverGenerator(plop);
	}
}
