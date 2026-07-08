import { APIGenerator } from "script";

await APIGenerator.init("test1")
	.withBarrel("../../packages/api/src/generated")
	.generate();

process.exit();
