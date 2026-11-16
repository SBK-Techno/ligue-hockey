import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { generateBranding, checksumOf } from './lib/branding.ts';

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

if (failures.length > 0) {
	process.stderr.write(
		`Generated assets are out of date. Run "npm run generate".\n${failures
			.map((failure) => `  - ${failure}`)
			.join('\n')}\n`
	);
	process.exit(1);
}

process.stdout.write('Generated assets are up to date.\n');
