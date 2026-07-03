export abstract class BasePlugin {
  abstract onStart(): Promise<void>;
  abstract onStop(): Promise<void>;
}
