export abstract class BasePlugin {
  /** Starts this plugin's infra connection, typically registering a client into the container. */
  abstract onStart(): Promise<void>;
  /** Stops this plugin's infra connection. */
  abstract onStop(): Promise<void>;
}
