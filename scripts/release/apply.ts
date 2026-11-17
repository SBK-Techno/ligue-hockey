import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { syncEnvExample } from './env-example.ts';
import { parseVersion } from './version.ts';

function argument(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) throw new Error(`Argument requis: ${name} <valeur>`);
	return value;
}

try {
	const version = argument('--version');
	parseVersion(version);

	execFileSync(
		'npm',
		['version', version, '--no-git-tag-version', '--allow-same-version'],
		{ stdio: 'inherit' }
	);

	const envPath = join(process.cwd(), '.env.example');
	const current = readFileSync(envPath, 'utf8');
	const next = syncEnvExample(current, version);
	if (next !== current) writeFileSync(envPath, next);

	process.stdout.write(`Version ${version} appliquée à package.json et .env.example.\n`);
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
}
