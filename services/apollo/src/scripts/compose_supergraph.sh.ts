import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { createFolder } from "lib";

createFolder("dist");

const serversRoot = join(import.meta.dir, "../../../../servers");
const serverDirs = (await readdir(serversRoot, { withFileTypes: true }))
	.filter((d) => d.isDirectory())
	.map((d) => join(serversRoot, d.name));

const procs = serverDirs.map((dir) =>
	Bun.spawn(["bun", "run", "index.ts"], {
		cwd: dir,
		stdout: "pipe",
		stderr: "inherit",
	}),
);

async function waitReady(proc: Bun.Subprocess) {
	const dec = new TextDecoder();
	for await (const chunk of proc.stdout as ReadableStream<Uint8Array>) {
		const text = dec.decode(chunk);
		process.stdout.write(text);
		if (text.includes("Server running at")) return;
	}
}

await Promise.all(procs.map(waitReady));
await $`rover supergraph compose --config ./src/config/supergraph.yaml --output ./dist/supergraph.graphql --elv2-license=accept`;
procs.forEach((p) => {
	p.kill();
});

process.exit();
