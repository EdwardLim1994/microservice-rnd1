import type { PlopTypes } from "@turbo/gen";
import { findFrontendWorkspaces } from "../helpers";
import ComponentGenerator from "./ComponentGenerator";
import MobileProjectGenerator from "./MobileProjectGenerator";
import ModuleGenerator from "./ModuleGenerator";
import PageGenerator from "./PageGenerator";
import ProjectGenerator from "./ProjectGenerator";
import ViewmodelGenerator from "./ViewmodelGenerator";

export default class FrontendCodeGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		const frontendWorkspaces = findFrontendWorkspaces(process.cwd());

		ProjectGenerator.apply(plop);
		MobileProjectGenerator.apply(plop);
		ModuleGenerator.apply(plop, frontendWorkspaces);
		PageGenerator.apply(plop, frontendWorkspaces);
		ViewmodelGenerator.apply(plop, frontendWorkspaces);
		ComponentGenerator.apply(plop, frontendWorkspaces);
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new FrontendCodeGenerator(plop);
	}
}
