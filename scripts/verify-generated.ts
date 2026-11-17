import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { generateBranding, checksumOf } from './lib/branding.ts';
import { isRetainedHashedAsset } from './lib/asset-retention.ts';

const GENERATED_TEXT_EXTENSIONS = new Set([
	'.html',
	'.txt',
	'.xml',
	'.json',
	'.webmanifest',
	'.svg',
	'.css',
	'.js'
]);

async function listFiles(root: string, relative = ''): Promise<string[]> {
	const entries = await readdir(path.join(root, relative), { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const next = path.join(relative, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFiles(root, next)));
		} else {
			files.push(next.split(path.sep).join('/'));
		}
	}
	return files;
}

const root = process.cwd();
const expected = await generateBranding(root);
const expectedByPath = new Map(expected.map((file) => [file.path, file]));
const failures: string[] = [];

for (const file of expected) {
	try {
		const actual = await readFile(path.join(root, file.path));
		const expectedBuffer = Buffer.isBuffer(file.contents)
			? file.contents
			: Buffer.from(file.contents);
		if (!actual.equals(expectedBuffer)) {
			failures.push(
				`stale: ${file.path} (expected ${checksumOf(expectedBuffer).slice(0, 12)}, found ${checksumOf(actual).slice(0, 12)})`
			);
		}
	} catch {
		failures.push(`missing: ${file.path}`);
	}
}

try {
	const checksums = JSON.parse(
		await readFile(path.join(root, 'static/generated-assets.json'), 'utf8')
	) as { files: Record<string, string> };
	const expectedPaths = expected
		.map((file) => file.path)
		.filter((file) => file !== 'static/generated-assets.json')
		.sort();
	const recordedPaths = Object.keys(checksums.files).sort();

	if (JSON.stringify(expectedPaths) !== JSON.stringify(recordedPaths)) {
		failures.push('checksum manifest does not match the generated file set');
	}

	for (const [file, checksum] of Object.entries(checksums.files)) {
		const generated = expectedByPath.get(file);
		if (!generated) {
			failures.push(`checksum entry has no generator: ${file}`);
			continue;
		}
		if (checksumOf(generated.contents) !== checksum) {
			failures.push(`checksum mismatch: ${file}`);
		}
	}
} catch {
	failures.push('missing or invalid static/generated-assets.json');
}

const generatedStatic = new Set(
	expected.map((file) => file.path).filter((file) => file.startsWith('static/'))
);
generatedStatic.add('static/generated-assets.json');

for (const file of await listFiles(path.join(root, 'static'))) {
	const relative = `static/${file}`;
	if (!GENERATED_TEXT_EXTENSIONS.has(path.extname(file))) continue;
	if (generatedStatic.has(relative)) continue;
	// Un actif daté remplacé reste servi pendant la fenêtre de cache. Son nom
	// porte le préfixe de son propre contenu, donc il reste vérifié.
	const contents = await readFile(path.join(root, 'static', file));
	if (isRetainedHashedAsset(relative, checksumOf(contents))) continue;
	failures.push(`hand-maintained static text asset: ${relative}`);
}

if (failures.length > 0) {
	process.stderr.write(
		`Generated assets are out of date. Run "npm run generate".\n${failures
			.map((failure) => `  - ${failure}`)
			.join('\n')}\n`
	);
	process.exit(1);
}

process.stdout.write('Generated assets are up to date.\n');
