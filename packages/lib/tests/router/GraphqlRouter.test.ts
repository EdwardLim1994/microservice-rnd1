import { expect, test } from "@rstest/core";
import { asValue, createContainer, InjectionMode } from "awilix";
import { BaseUseCase } from "../../src/abstract/BaseUseCase";
import {
	type GraphqlHandlerMap,
	GraphqlRouter,
} from "../../src/router/GraphqlRouter";

class HelloUseCase extends BaseUseCase<{ name: string }, string> {
	async execute(input: { name: string }) {
		return `Hello ${input.name}`;
	}
}

class TestGraphqlRouter extends GraphqlRouter {
	get typeDefs() {
		return `type Query { hello(name: String): String }`;
	}
	get handlers(): GraphqlHandlerMap {
		return { Query: { hello: HelloUseCase } };
	}
}

function makeContainer() {
	return createContainer({ injectionMode: InjectionMode.PROXY });
}

test("register() is a no-op", () => {
	const container = makeContainer();
	const router = new TestGraphqlRouter(container);
	expect(() => router.register({})).not.toThrow();
});

test("resolvers getter auto-registers use cases in container", () => {
	const container = makeContainer();
	const router = new TestGraphqlRouter(container);

	const _ = router.resolvers;

	expect(container.hasRegistration("helloUseCase")).toBe(true);
});

test("resolvers getter returns correct type-keyed structure", () => {
	const container = makeContainer();
	const router = new TestGraphqlRouter(container);
	const resolvers = router.resolvers;

	expect(resolvers).toHaveProperty("Query");
	expect(resolvers.Query).toHaveProperty("hello");
	expect(typeof resolvers.Query.hello).toBe("function");
});

test("resolver function calls use case execute with args", async () => {
	const container = makeContainer();
	const router = new TestGraphqlRouter(container);
	const resolvers = router.resolvers;

	const result = await (resolvers.Query.hello as Function)(null, {
		name: "World",
	});
	expect(result).toBe("Hello World");
});

test("resolvers skips already-registered use cases", () => {
	const container = makeContainer();
	const existingInstance = new HelloUseCase();
	container.register({ helloUseCase: asValue(existingInstance) });

	const router = new TestGraphqlRouter(container);
	const _ = router.resolvers;

	expect(container.resolve("helloUseCase")).toBe(existingInstance);
});
