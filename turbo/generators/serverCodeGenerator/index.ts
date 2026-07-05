import type { PlopTypes } from "@turbo/gen";
import {
	findPrismaServerWorkspaces,
	findServerWorkspaces,
	registerAppendBarrelAction,
} from "../helpers";
import InterceptorGenerator from "./InterceptorGenerator";
import RepositoryGenerator from "./RepositoryGenerator";
import RouterGenerator from "./RouterGenerator";
import ServerGenerator from "./ServerGenerator";
import UsecaseGenerator from "./UsecaseGenerator";

export default class ServerCodeGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		const serverWorkspaces = findServerWorkspaces(process.cwd());
		const prismaServerWorkspaces = findPrismaServerWorkspaces(process.cwd());

		registerAppendBarrelAction(plop);

		ServerGenerator.apply(plop);
		UsecaseGenerator.apply(plop, serverWorkspaces);
		RepositoryGenerator.apply(plop, prismaServerWorkspaces);
		InterceptorGenerator.apply(plop, serverWorkspaces);
		RouterGenerator.apply(plop, serverWorkspaces);
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new ServerCodeGenerator(plop);
	}
}
