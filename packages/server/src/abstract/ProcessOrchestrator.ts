import { type AwilixContainer, asClass } from 'awilix';
import { BaseUseCase } from './BaseUseCase';

type Constructor<T> = new (...args: any[]) => T;

export interface StepOptions {
  /** Additional attempts after the first if the main use case throws/times out. Default 0. */
  retries?: number;
  /** Delay between retry attempts. Default 0. */
  retryDelayMs?: number;
  /** Per-attempt timeout — unset means no timeout. */
  timeoutMs?: number;
}

interface SagaStep<TContext> {
  main: Constructor<BaseUseCase<TContext, Partial<TContext>>>;
  fallback: Constructor<BaseUseCase<TContext, unknown>>;
  options: StepOptions;
}

export class StepTimeoutError extends Error {}

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms?: number): Promise<T> {
  if (!ms) return promise;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new StepTimeoutError(`step timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Orchestrated SAGA: runs registered steps in order against a shared context, merging each main
 * use case's return into it. On a step's failure, runs the fallback (compensation) use case of
 * every already-completed step, in reverse order, then rethrows.
 */
export abstract class ProcessOrchestrator<TContext> extends BaseUseCase<
  TContext,
  TContext
> {
  private readonly container: AwilixContainer;
  private readonly steps: SagaStep<TContext>[] = [];

  constructor({ container }: { container: AwilixContainer }) {
    super();
    this.container = container;
  }

  /** Registers one step: `main` runs forward, `fallback` compensates if a later step fails. */
  protected step(
    main: Constructor<BaseUseCase<TContext, Partial<TContext>>>,
    fallback: Constructor<BaseUseCase<TContext, unknown>>,
    options: StepOptions = {},
  ): this {
    this.steps.push({ main, fallback, options });
    return this;
  }

  /** Subclasses register steps here, in execution order, via repeated `this.step(Main, Fallback)`. */
  protected abstract build(): void;

  async execute(input: TContext): Promise<TContext> {
    this.build();

    let context = input;
    const completed: SagaStep<TContext>[] = [];

    for (const step of this.steps) {
      const attempts = (step.options.retries ?? 0) + 1;
      let lastErr: unknown;
      let patch: Partial<TContext> | undefined;
      let succeeded = false;

      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          patch = await withTimeout(
            this.resolve(step.main).execute(context),
            step.options.timeoutMs,
          );
          succeeded = true;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < attempts - 1 && step.options.retryDelayMs) {
            await sleep(step.options.retryDelayMs);
          }
        }
      }

      if (!succeeded) {
        for (const done of completed.reverse()) {
          await this.resolve(done.fallback).execute(context);
        }
        throw lastErr;
      }

      context = { ...context, ...patch };
      completed.push(step);
    }

    return context;
  }

  private resolve<T>(UseCase: Constructor<T>): T {
    const token = lcFirst(UseCase.name);
    if (!this.container.hasRegistration(token)) {
      this.container.register({ [token]: asClass(UseCase).transient() });
    }
    return this.container.resolve<T>(token);
  }
}
