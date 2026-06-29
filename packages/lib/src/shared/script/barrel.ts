import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { capitalize } from 'lodash';

export const writeSubDirBarrels = async (dir: string): Promise<void> => {
	const entries = readdirSync(dir, { withFileTypes: true });
	const subDirs = entries.filter((e) => e.isDirectory());

	for (const subDir of subDirs) {
		await writeSubDirBarrels(join(dir, subDir.name));
	}

	const tsFiles = entries
		.filter(
			(e) => e.isFile() && e.name.endsWith('.ts') && e.name !== 'index.ts',
		)
		.map((e) => e.name.replace(/\.ts$/, ''));

	if (tsFiles.length > 0 || subDirs.length > 0) {
		const lines = [
			...tsFiles.map((f) => `export * from "./${f}"`),
			...subDirs.map((d) => `export * from "./${d.name}"`),
		];
		await Bun.write(join(dir, 'index.ts'), `${lines.join('\n')}\n`);
	}
};

export const collectSubDirExports = async (
	dir: string,
	relPath: string,
	lines: string[],
	seen: Set<string>,
): Promise<void> => {
	if (!existsSync(dir)) return;

	const entries = readdirSync(dir, { withFileTypes: true });
	const subDirs = entries.filter((e) => e.isDirectory());

	for (const d of subDirs) {
		await collectSubDirExports(
			join(dir, d.name),
			`${relPath}/${d.name}`,
			lines,
			seen,
		);
	}

	const hasTs = entries.some(
		(e) => e.isFile() && e.name.endsWith('.ts') && e.name !== 'index.ts',
	);
	if (!hasTs && subDirs.length === 0) return;

	const nsKey = relPath
		.split('/')
		.filter((p) => !['proto', 'src', 'generated'].includes(p))
		.join('/');
	if (seen.has(nsKey)) return;
	seen.add(nsKey);

	const ns = nsKey
		.split('/')
		.map((item) => capitalize(item))
		.join('');
	lines.push(`export * as ${ns} from "./${relPath}"`);
};
