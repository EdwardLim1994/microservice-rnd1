export abstract class BaseInterceptor {
  abstract apply(server: unknown): void;
}
