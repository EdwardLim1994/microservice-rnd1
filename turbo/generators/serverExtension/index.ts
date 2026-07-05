import type { PlopTypes } from "@turbo/gen";
import { findServerWorkspacesWithoutGrpc, findServerWorkspacesWithoutPrisma } from "../helpers";
import DatabaseGenerator from "./DatabaseGenerator";
import GrpcGenerator from "./GrpcGenerator";

export default class ServerExtensionGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		const serverWorkspacesWithoutPrisma = findServerWorkspacesWithoutPrisma(process.cwd());
		const serverWorkspacesWithoutGrpc = findServerWorkspacesWithoutGrpc(process.cwd());

		DatabaseGenerator.apply(plop, serverWorkspacesWithoutPrisma);
		GrpcGenerator.apply(plop, serverWorkspacesWithoutGrpc);
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new ServerExtensionGenerator(plop);
	}
}
