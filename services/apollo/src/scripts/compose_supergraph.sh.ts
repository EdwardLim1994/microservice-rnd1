import { join } from "node:path";
import { $ } from "bun";
import { createFolder } from "script";

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

async function waitReady(proc: Bun.Subprocess) {
	const dec = new TextDecoder();
	for await (const chunk of proc.stdout as ReadableStream<Uint8Array>) {
		const text = dec.decode(chunk);
		process.stdout.write(text);
		if (text.includes("GraphQL server is running on")) return;
	}
}

// Spawned and awaited one at a time, not concurrently: every listed server calls
// VaultPgAdapter.fromEnv() on boot, logging into Vault via AppRole then reading a fresh dynamic
// Postgres credential. Starting all of them at once reliably made Vault's single-node dev-mode
// backend return spurious "permission denied" on some of those near-simultaneous
// database/creds/* reads, even though the exact same request always succeeds in isolation
// (confirmed directly against Vault's HTTP API) — a fixed stagger between spawns wasn't enough to
// avoid it either, since each server's own boot time before it reaches the Vault call varies.
// Waiting for full readiness before starting the next server sidesteps the race entirely.
const procs: Bun.Subprocess[] = [];
for (const dir of serverDirs) {
	const proc = Bun.spawn(["bun", "run", "index.ts"], {
		cwd: dir,
		stdout: "pipe",
		stderr: "inherit",
	});
	procs.push(proc);
	await waitReady(proc);
}
await $`rover supergraph compose --config ./src/config/supergraph.yaml --output ./dist/supergraph.graphql --elv2-license=accept`;
procs.forEach((p) => {
	p.kill();
});

process.exit();
