import type { PlopTypes } from "@turbo/gen";
import {
	findPrismaServerWorkspaces,
	findServerWorkspacesWithoutPrisma,
} from "../helpers";
import CdcGenerator from "./CdcGenerator";
import DatabaseGenerator from "./DatabaseGenerator";

export default class ServerExtensionGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		const serverWorkspacesWithoutPrisma = findServerWorkspacesWithoutPrisma(
			process.cwd(),
		);
		const prismaServerWorkspaces = findPrismaServerWorkspaces(process.cwd());

		DatabaseGenerator.apply(plop, serverWorkspacesWithoutPrisma);
		CdcGenerator.apply(plop, prismaServerWorkspaces);
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new ServerExtensionGenerator(plop);
	}
}
