export abstract class BaseUseCase<TInput, TOutput> {
  /** Runs this use case's single business operation. */
  abstract execute(input: TInput): Promise<TOutput>;
}
