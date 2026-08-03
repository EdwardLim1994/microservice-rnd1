import { type AwilixContainer, asClass } from 'awilix';
import { BaseRouter } from '../abstract/BaseRouter';
import type { BaseUseCase } from '../abstract/BaseUseCase';
import { withServerSpan } from '../otel-span';

export type GraphqlHandlerMap = {
  [typeName: string]: {
    [fieldName: string]: new (...args: any[]) => BaseUseCase<any, any>;
  };
};

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export abstract class GraphqlRouter extends BaseRouter {
  constructor(protected readonly container: AwilixContainer) {
    super();
  }

  /** This router's GraphQL SDL — may use federation directives (`@key`, `@external`, etc.). */
  abstract get typeDefs(): string;
  /** Maps each GraphQL type/field to the use case that resolves it. */
  abstract get handlers(): GraphqlHandlerMap;

  /**
   * Builds Apollo resolvers from `handlers`, auto-registering each use case into the container
   * transiently. Root fields (Query/Mutation) receive GraphQL args as input; fields on entity
   * types (including `__resolveReference`) receive the parent/reference object instead.
   */
  get resolvers(): Record<string, Record<string, unknown>> {
    return Object.fromEntries(
      Object.entries(this.handlers).map(([typeName, fields]) => {
        for (const UseCase of Object.values(fields)) {
          const token = lcFirst(UseCase.name);
          if (!this.container.hasRegistration(token)) {
            this.container.register({
              [token]: asClass(UseCase as any).transient(),
            });
          }
        }

        // Query/Mutation fields are root fields — their only input is GraphQL args.
        // Fields on entity types (including __resolveReference) receive the parent/reference
        // object instead, since that's what identifies which entity to resolve.
        const isRootType = typeName === 'Query' || typeName === 'Mutation';

        const resolvedFields = Object.fromEntries(
          Object.entries(fields).map(([field, UseCase]) => {
            const token = lcFirst(UseCase.name);
            return [
              field,
              async (parent: unknown, args: unknown) => {
                return withServerSpan(
                  this.container,
                  `graphql.${typeName}.${field}`,
                  () => {
                    const useCase =
                      this.container.resolve<BaseUseCase<any, any>>(token);
                    return useCase.execute(isRootType ? args : parent);
                  },
                );
              },
            ];
          }),
        );

        return [typeName, resolvedFields];
      }),
    );
  }
}
