import { join } from "node:path";
import { VaultTlsAdapter } from "server";
import { createFolder } from "script";

createFolder("dist");

const tls = await VaultTlsAdapter.fromEnv();

await Promise.all([
	Bun.write(join(import.meta.dir, "../../dist/ca.pem"), tls.ca),
	Bun.write(join(import.meta.dir, "../../dist/cert.pem"), tls.cert),
	Bun.write(join(import.meta.dir, "../../dist/key.pem"), tls.key),
]);

console.log("Wrote dist/ca.pem, dist/cert.pem, dist/key.pem");
