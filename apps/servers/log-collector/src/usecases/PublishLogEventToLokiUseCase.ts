import { type LogEvent, BaseUseCase } from "server";

const LOKI_PUSH_URL =
	process.env.LOKI_PUSH_URL ?? "http://localhost:3100/loki/api/v1/push";

/** Loki's push API wants nanosecond-since-epoch as a string. */
function toLokiTimestamp(isoTimestamp: string): string {
	return String(new Date(isoTimestamp).getTime() * 1_000_000);
}

/**
 * Pushes one LogEvent (see packages/server/src/plugin/LoggerPlugin.ts) into Loki — `service`/
 * `level` become real Loki stream labels (same label names Alloy's own pipeline already uses,
 * see services/monitoring's alloy-config.alloy, so both log sources stay queryable the same
 * way), and the full event (including file/line, which Alloy has no way to know at all) goes in
 * as the log line itself, JSON-encoded so `| json` in a LogQL query can pull individual fields
 * back out.
 */
export default class PublishLogEventToLokiUseCase extends BaseUseCase<
	LogEvent,
	void
> {
	async execute(event: LogEvent): Promise<void> {
		const response = await fetch(LOKI_PUSH_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				streams: [
					{
						stream: { service: event.service, level: event.status },
						values: [[toLokiTimestamp(event.timestamp), JSON.stringify(event)]],
					},
				],
			}),
		});

		if (!response.ok) {
			throw new Error(
				`PublishLogEventToLokiUseCase: Loki push failed (${response.status}): ${await response.text()}`,
			);
		}
	}
}
