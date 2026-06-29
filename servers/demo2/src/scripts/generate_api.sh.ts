import { APIGenerator } from "lib/script";

await APIGenerator.init("demo2")
	.withBarrel("../../packages/api/src/generated")
	.generate();

process.exit();
