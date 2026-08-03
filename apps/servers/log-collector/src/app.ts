import {
	HealthCheckPlugin,
	JsonKafkaSerializer,
	KafkaDriver,
	ServerApp,
} from "server";
import LogEventRouter from "./routers/LogEventRouter";

export default async function main() {
	await ServerApp.init([
		{
			// Consumer-only — nothing here ever produces onto log-events itself, every other
			// server's own LoggerPlugin does that.
			driver: KafkaDriver,
			config: {
				serializer: new JsonKafkaSerializer(),
			},
			onReady: () => console.log("Kafka consumer is running"),
		},
	])
		.plugins([HealthCheckPlugin])
		.routers([LogEventRouter])
		.run(() => "log-collector is running");
}
