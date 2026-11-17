import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { envExampleVersion } from './env-example.ts';
import { parseVersion } from './version.ts';

type PackageFile = { version?: string };
type LockFile = {
	version?: string;
	packages?: Record<string, { version?: string }>;
};

const root = process.cwd();
const problems: string[] = [];

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(join(root, path), 'utf8')) as T;
}

const packageJson = readJson<PackageFile>('package.json');
if (!packageJson.version) {
	problems.push('package.json ne déclare pas de version.');
} else {
	try {
		parseVersion(packageJson.version);
	} catch (error) {
		problems.push(error instanceof Error ? error.message : String(error));
	}
}

const lock = readJson<LockFile>('package-lock.json');
if (packageJson.version && lock.version !== packageJson.version) {
	problems.push(
		`package-lock.json (${lock.version ?? 'absente'}) ne correspond pas à package.json (${packageJson.version}).`
	);
}
const lockRoot = lock.packages?.['']?.version;
if (packageJson.version && lockRoot !== packageJson.version) {
	problems.push(
		`package-lock.json packages[""].version (${lockRoot ?? 'absente'}) ne correspond pas à package.json (${packageJson.version}).`
	);
}

try {
	const envVersion = envExampleVersion(readFileSync(join(root, '.env.example'), 'utf8'));
	if (packageJson.version && envVersion !== packageJson.version) {
		problems.push(
			`.env.example (${envVersion}) ne correspond pas à package.json (${packageJson.version}). Lance npm run release:apply --version ${packageJson.version}.`
		);
	}
} catch (error) {
	problems.push(error instanceof Error ? error.message : String(error));
}

if (problems.length > 0) {
	for (const problem of problems) process.stderr.write(`${problem}\n`);
	process.exitCode = 1;
} else {
	process.stdout.write(`Version ${packageJson.version} cohérente dans package.json, package-lock.json et .env.example.\n`);
}
