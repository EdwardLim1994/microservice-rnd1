import { type AwilixContainer, asValue } from 'awilix';
import { Kafka, type KafkaConfig, type Producer } from 'kafkajs';
import { BasePlugin } from '../abstract/BasePlugin';

/** Every server publishes onto this one shared topic. No consumer currently exists in this repo — apps/servers/log-collector, the previous consumer, was removed. */
export const LOG_EVENTS_TOPIC = 'log-events';

export type LogStatus = 'info' | 'warn' | 'error';

/** What actually lands in Kafka, one JSON message per log call. */
export interface LogEvent {
  service: string;
  timestamp: string;
  status: LogStatus;
  message: string;
  file: string;
  line: number;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const SELF_PATH = new URL(import.meta.url).pathname;

/**
 * Finds the first stack frame outside this file — i.e. whoever actually called
 * logger.info()/warn()/error(), not this plugin's own internal call chain. Works the same
 * whether this file is running as raw TS (dev, `bun run index.ts`) or bundled into
 * packages/server's built dist/index.js (prod) — SELF_PATH is resolved from `import.meta.url` at
 * runtime, so it always matches wherever this module actually ended up.
 */
function callerLocation(): { file: string; line: number } {
  const stack = new Error().stack?.split('\n').slice(1) ?? [];
  for (const frame of stack) {
    const match = /\(?([^\s():]+):(\d+)(?::(\d+))?\)?\s*$/.exec(frame.trim());
    if (!match) continue;
    if (match[1] === SELF_PATH) continue;
    return { file: match[1], line: Number(match[2]) };
  }
  return { file: 'unknown', line: 0 };
}

/**
 * Publishes every log.info()/warn()/error() call as a LogEvent onto Kafka's shared "log-events"
 * topic — a deliberately separate producer connection from KafkaDriver's own (not borrowed via
 * the container), same as RedisPlugin/MeilisearchPlugin manage their own client rather than
 * reaching into another driver/plugin's registration. Keeps this decoupled from whether a given
 * server also uses KafkaDriver for its own business messaging, and sidesteps ServerApp.run()'s
 * ordering (plugins start *before* drivers — see ServerApp.ts — so a KafkaDriver-registered
 * `kafkaProducer` wouldn't exist yet at this plugin's own onStart() time anyway).
 *
 * Alongside, not instead of, Alloy's container-log tailing (services/monitoring's alloy-config
 * .alloy) — Alloy already gets every server's plain console.log/console.error for free, no code
 * change needed; this exists specifically for the structured fields (real status, file, line)
 * a stdout/stderr guess can't give.
 */
export class LoggerPlugin extends BasePlugin {
  private producer?: Producer;

  // ponytail: factory param allows injection in tests without touching the real client
  constructor(
    private readonly container: AwilixContainer,
    private readonly serviceName: string = process.env.OTEL_SERVICE_NAME ??
      'unknown-service',
    private readonly createKafka: (config: KafkaConfig) => Kafka = (config) =>
      new Kafka(config),
  ) {
    super();
  }

  /** Connects a producer (provisioning the shared topic up front) and registers `logger` into the container. */
  async onStart(): Promise<void> {
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:29092').split(',');
    const kafka = this.createKafka({
      brokers,
      clientId: `${this.serviceName}-logger`,
    });

    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({ topics: [{ topic: LOG_EVENTS_TOPIC }] });
    await admin.disconnect();

    this.producer = kafka.producer();
    await this.producer.connect();

    const publish = (status: LogStatus, message: string): void => {
      const { file, line } = callerLocation();
      const event: LogEvent = {
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        status,
        message,
        file,
        line,
      };
      // Fire-and-forget — a Kafka hiccup must never block or crash the request that triggered
      // this log call. Falls back to console so the message isn't lost outright (Alloy still
      // picks that up from stdout/stderr).
      this.producer
        ?.send({
          topic: LOG_EVENTS_TOPIC,
          messages: [{ value: JSON.stringify(event) }],
        })
        .catch(() => {
          const logFn = status === 'error' ? console.error : console.log;
          logFn(`[${status}] ${message} (${file}:${line})`);
        });
    };

    const logger: Logger = {
      info: (message) => publish('info', message),
      warn: (message) => publish('warn', message),
      error: (message) => publish('error', message),
    };
    this.container.register({ logger: asValue(logger) });
  }

  /** Disconnects the producer. */
  async onStop(): Promise<void> {
    await this.producer?.disconnect();
  }
}
