export interface DbAdapter {
  readonly adapter: unknown;
  end(): Promise<void>;
}
