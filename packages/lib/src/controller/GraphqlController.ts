import type { BaseContext } from '@apollo/server';
import type { IResolvers } from '@graphql-tools/utils';
import type { DocumentNode } from 'graphql';
import { BaseController } from '../shared';

export type GraphqlControllerSchema<
	TContext extends BaseContext = BaseContext,
> = {
	typeDefs: DocumentNode;
	resolvers: IResolvers<unknown, TContext>;
};

export default abstract class GraphqlController<
	TContext extends BaseContext = BaseContext,
> extends BaseController {
	constructor(protected typeDefs: DocumentNode) {
		super();
	}

	protected abstract prepareResolvers(): IResolvers<unknown, TContext>;

	public register(): GraphqlControllerSchema<TContext> {
		return {
			typeDefs: this.typeDefs,
			resolvers: this.prepareResolvers(),
		};
	}
}
