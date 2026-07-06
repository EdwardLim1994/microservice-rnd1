import type { PlopTypes } from "@turbo/gen";
import { findServerWorkspacesWithoutPrisma } from "../helpers";
import DatabaseGenerator from "./DatabaseGenerator";

export default class ServerExtensionGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		const serverWorkspacesWithoutPrisma = findServerWorkspacesWithoutPrisma(process.cwd());

		DatabaseGenerator.apply(plop, serverWorkspacesWithoutPrisma);
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new ServerExtensionGenerator(plop);
	}
}
