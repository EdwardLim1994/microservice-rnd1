import { APIGenerator } from "script";

await APIGenerator.init("auth")
	.withBarrel("../../packages/api/src/generated")
	.generate();

process.exit();
