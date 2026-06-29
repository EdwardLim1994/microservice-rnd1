import { APIGenerator } from "lib/script";

await APIGenerator.init("demo1")
	.withBarrel("../../packages/api/src/generated")
	.generate();

process.exit();
