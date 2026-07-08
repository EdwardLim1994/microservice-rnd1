import { APIGenerator } from "script";

await APIGenerator.init("test2")
	.withBarrel("../../packages/api/src/generated")
	.generate();

process.exit();
