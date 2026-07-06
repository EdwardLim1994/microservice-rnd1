import type { PlopTypes } from "@turbo/gen";
import ServerCodeGenerator from "./serverCodeGenerator";
import ServerDriverGenerator from "./serverDriver";
import ServerExtensionGenerator from "./serverExtension";

export default function generator(plop: PlopTypes.NodePlopAPI): void {
	ServerCodeGenerator.apply(plop);
	ServerExtensionGenerator.apply(plop);
	ServerDriverGenerator.apply(plop);
}
