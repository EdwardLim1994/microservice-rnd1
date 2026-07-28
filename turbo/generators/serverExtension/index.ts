import type { PlopTypes } from "@turbo/gen";
import {
	findPrismaServerWorkspaces,
	findServerWorkspaces,
	findServerWorkspacesWithoutPrisma,
} from "../helpers";
import DatabaseGenerator from "./DatabaseGenerator";
import DebeziumGenerator from "./DebeziumGenerator";
import RedisGenerator from "./RedisGenerator";

export default class ServerExtensionGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		const serverWorkspacesWithoutPrisma = findServerWorkspacesWithoutPrisma(
			process.cwd(),
		);
		const prismaServerWorkspaces = findPrismaServerWorkspaces(process.cwd());

		DatabaseGenerator.apply(plop, serverWorkspacesWithoutPrisma);
		DebeziumGenerator.apply(plop, prismaServerWorkspaces);
		RedisGenerator.apply(plop, findServerWorkspaces(process.cwd()));
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new ServerExtensionGenerator(plop);
	}
}
