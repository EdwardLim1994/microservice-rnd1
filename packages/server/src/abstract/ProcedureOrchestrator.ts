import { type AwilixContainer, asClass } from 'awilix';
import { BaseUseCase } from './BaseUseCase';

type Constructor<T> = new (...args: any[]) => T;

export interface ProcedureOptions {
  /** Additional attempts after the first if the main use case throws/times out. Default 0. */
  retries?: number;
  /** Delay between retry attempts. Default 0. */
  retryDelayMs?: number;
  /** Per-attempt timeout — unset means no timeout. */
  timeoutMs?: number;
}

interface SagaProcedure<TContext> {
  main: Constructor<BaseUseCase<TContext, Partial<TContext>>>;
  fallback: Constructor<BaseUseCase<TContext, unknown>>;
  options: ProcedureOptions;
}

export class ProcedureTimeoutError extends Error {}

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms?: number): Promise<T> {
  if (!ms) return promise;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new ProcedureTimeoutError(`procedure timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Orchestrated SAGA: runs registered procedures in order against a shared context, merging each main
 * use case's return into it. On a procedure's failure, runs the fallback (compensation) use case of
 * every already-completed procedure, in reverse order, then rethrows.
 */
export abstract class ProcedureOrchestrator<TContext> extends BaseUseCase<
  TContext,
  TContext
> {
  private readonly container: AwilixContainer;
  private readonly procedures: SagaProcedure<TContext>[] = [];

  constructor({ container }: { container: AwilixContainer }) {
    super();
    this.container = container;
  }

  /** Registers one procedure: `main` runs forward, `fallback` compensates if a later procedure fails. */
  protected procedure(
    main: Constructor<BaseUseCase<TContext, Partial<TContext>>>,
    fallback: Constructor<BaseUseCase<TContext, unknown>>,
    options: ProcedureOptions = {},
  ): this {
    this.procedures.push({ main, fallback, options });
    return this;
  }

  /** Subclasses register procedures here, in execution order, via repeated `this.procedure(Main, Fallback)`. */
  protected abstract build(): void;

  async execute(input: TContext): Promise<TContext> {
    this.build();

    let context = input;
    const completed: SagaProcedure<TContext>[] = [];

    for (const procedure of this.procedures) {
      const result = await this.attempt(procedure, context);
      if (!result.succeeded) {
        await this.compensate(completed, context);
        throw result.error;
      }

      context = { ...context, ...result.patch };
      completed.push(procedure);
    }

    return context;
  }

  private async attempt(
    procedure: SagaProcedure<TContext>,
    context: TContext,
  ): Promise<
    | { succeeded: true; patch: Partial<TContext> | undefined }
    | { succeeded: false; error: unknown }
  > {
    const attempts = (procedure.options.retries ?? 0) + 1;
    let lastErr: unknown;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const patch = await withTimeout(
          this.resolve(procedure.main).execute(context),
          procedure.options.timeoutMs,
        );
        return { succeeded: true, patch };
      } catch (err) {
        lastErr = err;
        if (attempt < attempts - 1 && procedure.options.retryDelayMs) {
          await sleep(procedure.options.retryDelayMs);
        }
      }
    }

    return { succeeded: false, error: lastErr };
  }

  private async compensate(
    completed: SagaProcedure<TContext>[],
    context: TContext,
  ): Promise<void> {
    const reversed = [...completed].reverse();
    for (const done of reversed) {
      await this.resolve(done.fallback).execute(context);
    }
  }

  private resolve<T>(UseCase: Constructor<T>): T {
    const token = lcFirst(UseCase.name);
    if (!this.container.hasRegistration(token)) {
      this.container.register({ [token]: asClass(UseCase).transient() });
    }
    return this.container.resolve<T>(token);
  }
}
