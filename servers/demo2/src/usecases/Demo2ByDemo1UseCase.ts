import type { Demo2Graphql } from "api";
import { BaseUseCase } from "lib";

export default class Demo2ByDemo1UseCase extends BaseUseCase<
	Demo2Graphql.FederationReferenceTypes["Demo1"],
	Demo2Graphql.Demo2[]
> {
	async execute(
		parent: Demo2Graphql.FederationReferenceTypes["Demo1"],
	): Promise<Demo2Graphql.Demo2[]> {
		return [{ id: `${parent.id}-demo2`, name: "Hello World Tester" }];
	}
}
