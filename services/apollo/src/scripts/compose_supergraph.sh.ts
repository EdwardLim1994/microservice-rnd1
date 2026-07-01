import { join } from "node:path";
import { $ } from "bun";
import { createFolder } from "lib";

createFolder("dist");

const supergraphConfigPath = join(
	import.meta.dir,
	"../config/supergraph.yaml",
);
const supergraphConfig = Bun.YAML.parse(
	await Bun.file(supergraphConfigPath).text(),
) as { subgraphs: Record<string, unknown> };

// Only the servers listed in supergraph.yaml expose a GraphQL subgraph —
// other servers (e.g. gRPC-only) never log "GraphQL server is running on" and would hang waitReady().
const serversRoot = join(import.meta.dir, "../../../../servers");
const serverDirs = Object.keys(supergraphConfig.subgraphs).map((name) =>
	join(serversRoot, name),
);

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
		if (text.includes("GraphQL server is running on")) return;
	}
}

await Promise.all(procs.map(waitReady));
await $`rover supergraph compose --config ./src/config/supergraph.yaml --output ./dist/supergraph.graphql --elv2-license=accept`;
procs.forEach((p) => {
	p.kill();
});

process.exit();
