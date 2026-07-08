import type { Test2Graphql } from "api";
import { BaseUseCase } from "server";

export default class GetTest2ForTest1UseCase extends BaseUseCase<
	Test2Graphql.FederationReferenceTypes["Test1"],
	Test2Graphql.Test2[]
> {
	async execute(
		parent: Test2Graphql.FederationReferenceTypes["Test1"],
	): Promise<Test2Graphql.Test2[]> {
		return [{ id: `${parent.id}-test2` }];
	}
}
