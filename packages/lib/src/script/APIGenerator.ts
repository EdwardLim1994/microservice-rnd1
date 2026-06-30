import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { capitalize } from "lodash";
import {
	checkDependency,
	collectSubDirExports,
	createFolder,
	log,
	writeSubDirBarrels,
} from "../shared/script/";

export default class APIGenerator {
	private _barrelRoot: string;
	private _path: string = "src/generated";
	private _apiPath: string = "../../packages/api";

	private constructor(private readonly _projectName: string) {
		this._barrelRoot = `${this._apiPath}/${this._path}`;
	}

	public static init(projectName: string) {
		return new APIGenerator(projectName);
	}

	public apiLocation(apiLocation: string) {
		this._apiPath = apiLocation;
		return this;
	}

	public path(path: string) {
		this._path = path;
		return this;
	}

	public withBarrel(generatedRoot: string) {
		this._barrelRoot = generatedRoot;
		return this;
	}

	public async generate(): Promise<void> {
		log.info(`API will be generated in ${this._apiPath}/${this._path}`);
		try {
			await this.generateGraphqlAPI();
			await this.generateGrpcAPI();
			await this.generateBarrel(this._barrelRoot);
		} catch (err) {
			log.error(`Failed to generate API: ${err}`);
		}
	}

	private async generateGraphqlAPI() {
		const isGraphqlCodeGenExists = checkDependency("graphql-codegen.exe");

		if (isGraphqlCodeGenExists) {
			log.info("GraphQL Codegen is installed. Compiling...");
			await Bun.$`./node_modules/.bin/graphql-codegen --config ./src/configs/graphql/codegen.ts`;
			log.success("GraphQL Codegen compiled successfully");
		} else {
			log.warn("GraphQL Codegen is not installed. Skipping...");
		}
	}

	private async generateGrpcAPI() {
		const isProtocExists = checkDependency("protoc.exe");

		if (isProtocExists) {
			log.info("Protoc is installed. Compiling...");
			const bufCacheDir = `${process.env.LOCALAPPDATA ?? process.env.USERPROFILE + "/.cache"}/buf/cache`;
			await Bun.$`./node_modules/.bin/buf generate --template ./src/configs/proto/buf.gen.yaml`.env(
				{ ...process.env, BUF_CACHE_DIR: bufCacheDir },
			);
			const protoOutDir = join(
				this._apiPath,
				this._path,
				this._projectName,
				"proto",
			);
			for (const entry of readdirSync(protoOutDir, {
				withFileTypes: true,
			}).filter((e) => e.isDirectory())) {
				await writeSubDirBarrels(join(protoOutDir, entry.name));
			}
			log.success("Protoc compiled successfully");
		} else {
			log.warn("Protoc is not installed. Skipping...");
		}
	}

	private async generateBarrel(generatedRoot: string) {
		const servers = readdirSync(generatedRoot, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name);

		const lines: string[] = ["// auto-generated, do not edit"];
		const addedSubNs = new Set<string>();

		for (const server of servers) {
			const ns = capitalize(server);

			if (existsSync(join(generatedRoot, server, "graphql", "index.ts"))) {
				lines.push(`export * as ${ns}Graphql from "./${server}/graphql"`);
			}

			const protoDir = join(generatedRoot, server, "proto");
			if (existsSync(protoDir)) {
				const entries = readdirSync(protoDir, { withFileTypes: true });

				for (const f of entries.filter(
					(e) => e.isFile() && e.name.endsWith(".ts") && e.name !== "index.ts",
				)) {
					const file = f.name.replace(/\.ts$/, "");
					lines.push(
						`export * as ${ns}${capitalize(file)}Proto from "./${server}/proto/${file}"`,
					);
				}

				for (const d of entries.filter((e) => e.isDirectory())) {
					await collectSubDirExports(
						join(protoDir, d.name),
						`${server}/proto/${d.name}`,
						lines,
						addedSubNs,
					);
				}
			}
		}

		const barrelPath = join(generatedRoot, "index.ts");
		await Bun.write(barrelPath, `${lines.join("\n")}\n`);
		log.success(`Barrel file written to ${barrelPath}`);
	}
}
