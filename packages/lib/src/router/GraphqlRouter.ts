import type { BaseContext } from "@apollo/server";
import type { IResolvers } from "@graphql-tools/utils";
import type { DocumentNode } from "graphql";
import { BaseRouter } from "../shared";

export type GraphqlRouterSchema<TContext extends BaseContext = BaseContext> = {
	typeDefs: DocumentNode;
	resolvers: IResolvers<unknown, TContext>;
};

export default abstract class GraphqlRouter<
	TContext extends BaseContext = BaseContext,
> extends BaseRouter {
	constructor(protected typeDefs: DocumentNode) {
		super();
	}

	protected abstract prepareResolvers(): IResolvers<unknown, TContext>;

	public register(): GraphqlRouterSchema<TContext> {
		return {
			typeDefs: this.typeDefs,
			resolvers: this.prepareResolvers(),
		};
	}
}
