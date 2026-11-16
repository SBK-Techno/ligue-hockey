import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fr } from '../config/i18n/fr.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const SCANNED_EXTENSIONS = ['.ts', '.js', '.svelte', '.css'];

type Finding = { file: string; line: number; rule: string; detail: string };

const findings: Finding[] = [];

function walk(directory: string, files: string[] = []): string[] {
	for (const entry of readdirSync(directory)) {
		if (entry === 'node_modules' || entry === '.svelte-kit' || entry === 'build') continue;
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) {
			walk(path, files);
		} else if (SCANNED_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
			files.push(path);
		}
	}
	return files;
}

function isAllowed(file: string, allowed: readonly string[]): boolean {
	return allowed.some((entry) => file === entry || file.startsWith(entry));
}

function check(
	file: string,
	rule: string,
	pattern: RegExp,
	allowed: readonly string[],
	detail: string
) {
	if (isAllowed(file, allowed)) return;
	const content = readFileSync(file, 'utf8');
	for (const [index, line] of content.split('\n').entries()) {
		if (pattern.test(line)) {
			findings.push({ file, line: index + 1, rule, detail });
		}
		pattern.lastIndex = 0;
	}
}

const sourceFiles = walk(join(ROOT, 'src'));

for (const file of sourceFiles) {
	check(
		file,
		'no-process-env',
		/\bprocess\.env\b/,
		[join(ROOT, 'src/lib/shared/config/env.ts')],
		'Read configuration through src/lib/shared/config/env.ts.'
	);
	check(
		file,
		'no-console',
		/\bconsole\.(log|info|warn|error|debug)\b/,
		[join(ROOT, 'src/lib/shared/logging/logger.ts')],
		'Log through src/lib/shared/logging/logger.ts.'
	);
	check(
		file,
		'no-ambient-clock',
		/\bnew Date\s*\(|\bDate\.now\s*\(/,
		[
			join(ROOT, 'src/lib/shared/time/clock.ts'),
			join(ROOT, 'src/lib/server/db/auth.schema.ts'),
			join(ROOT, 'src/lib/generated/')
		],
		'Use the clock adapter in src/lib/shared/time/clock.ts.'
	);
	check(
		file,
		'no-provider-imports',
		/from ['"](nodemailer|web-push)['"]/,
		[join(ROOT, 'src/lib/server/notifications/')],
		'Use the notification adapters, which own provider imports.'
	);
	const isDataOwner =
		file.startsWith(join(ROOT, 'src/lib/server/db/')) ||
		/\/src\/lib\/domain\/[^/]+\/(queries|schema)\.ts$/.test(file);
	check(
		file,
		'no-drizzle-outside-data',
		/from ['"]drizzle-orm|from ['"]drizzle-zod/,
		isDataOwner ? [file] : [],
		'Drizzle belongs to src/lib/server/db or domain queries.ts/schema.ts.'
	);
	check(
		file,
		'no-hex-colours',
		/#[0-9a-fA-F]{3,8}\b/,
		[join(ROOT, 'src/lib/ui/tokens.css'), join(ROOT, 'src/lib/generated/')],
		'Colours come from tokens.css or branding.json.'
	);
	check(
		file,
		'no-notification-bypass',
		/\bsendEmail\s*\(|\bsendPush\s*\(/,
		[join(ROOT, 'src/lib/server/notifications/')],
		'Notifications are queued through notify().'
	);

	if (file.startsWith(join(ROOT, 'src/routes/'))) {
		check(
			file,
			'no-data-in-routes',
			/from ['"][^'"]*(\/queries\.ts|server\/db)/,
			[],
			'Routes call services; data access belongs to the domain.'
		);
		check(
			file,
			'action-error-must-return',
			/^\s*actionError\(/,
			[],
			'Return actionError(cause) so SvelteKit receives the failure.'
		);
	}

	if (file.startsWith(join(ROOT, 'src/lib/domain/'))) {
		check(
			file,
			'domain-stays-portable',
			/from ['"](@sveltejs\/kit|\$app\/)/,
			[],
			'Domain services must not depend on SvelteKit.'
		);
	}
}

check(
	join(ROOT, 'drizzle.config.ts'),
	'no-process-env',
	/\bprocess\.env\b/,
	[join(ROOT, 'drizzle.config.ts')],
	'Build tooling may read the database URL from the environment.'
);

function checkCiContract() {
	const runnerTemplate = join(ROOT, 'scripts/ci/act-runner.yaml');
	const workflowFile = join(ROOT, '.gitea/workflows/verification.yml');
	for (const file of [runnerTemplate, workflowFile]) {
		if (!existsSync(file)) {
			findings.push({
				file,
				line: 1,
				rule: 'ci-contract',
				detail: 'The CI contract files must exist.'
			});
		}
	}
	if (!existsSync(runnerTemplate) || !existsSync(workflowFile)) return;

	const packageFile = join(ROOT, 'package.json');
	const packageJson = JSON.parse(readFileSync(packageFile, 'utf8')) as {
		engines?: { node?: string };
		scripts?: Record<string, string>;
	};
	const nodeMinimum = Number(packageJson.engines?.node?.match(/\d+/)?.[0] ?? NaN);

	if (!packageJson.scripts?.gate) {
		findings.push({
			file: packageFile,
			line: 1,
			rule: 'ci-contract',
			detail: 'package.json must declare the gate script.'
		});
	}

	const runnerConfig = readFileSync(runnerTemplate, 'utf8');
	const labelMatch = runnerConfig.match(
		/^\s+- "([a-z0-9._-]+):docker:\/\/node:(\d+)-/m
	);
	if (!labelMatch) {
		findings.push({
			file: runnerTemplate,
			line: 1,
			rule: 'ci-contract',
			detail: 'The runner must declare a label backed by a Node image.'
		});
		return;
	}
	const [, label, imageMajor] = labelMatch;
	if (Number(imageMajor) !== nodeMinimum) {
		findings.push({
			file: runnerTemplate,
			line: runnerConfig.slice(0, labelMatch.index).split('\n').length,
			rule: 'ci-contract',
			detail: `The runner Node image (${imageMajor}) must match engines.node (${nodeMinimum}).`
		});
	}

	const workflow = readFileSync(workflowFile, 'utf8');
	const lines = workflow.split('\n');
	const runOn = lines.findIndex((line) => /^\s*runs-on:/.test(line));
	if (runOn < 0 || !new RegExp(`^\\s*runs-on:\\s*${label}\\s*$`).test(lines[runOn])) {
		findings.push({
			file: workflowFile,
			line: runOn + 1,
			rule: 'ci-contract',
			detail: `The gate must run on the runner label ${label}.`
		});
	}
	if (!/\bnpm run gate\b/.test(workflow)) {
		findings.push({
			file: workflowFile,
			line: 1,
			rule: 'ci-contract',
			detail: 'The workflow must call the gate script.'
		});
	}
	for (const [index, line] of lines.entries()) {
		const action = line.match(/^\s*uses:\s*(\S+)/);
		if (action && !/@[0-9a-f]{40}$/.test(action[1])) {
			findings.push({
				file: workflowFile,
				line: index + 1,
				rule: 'ci-contract',
				detail: 'Actions must be pinned to a full commit SHA.'
			});
		}
	}
}

checkCiContract();

const knownKeys = new Set(Object.keys(fr));
for (const file of sourceFiles.filter(
	(entry) => entry.endsWith('.svelte') || entry.endsWith('.ts')
)) {
	const content = readFileSync(file, 'utf8');
	const literals = [
		...content.matchAll(/\bt\(\s*'([^'{}]+)'/g),
		...content.matchAll(/formatCount\([^,]+,\s*'([^'{}]+)'\s*,\s*'([^'{}]+)'/g)
	];
	for (const match of literals) {
		for (const key of match.slice(1).filter(Boolean)) {
			if (knownKeys.has(key)) continue;
			findings.push({
				file,
				line: content.slice(0, match.index).split('\n').length,
				rule: 'i18n-key-exists',
				detail: `Missing dictionary key: ${key}`
			});
		}
	}

	const counts = [
		...content.matchAll(
			/formatCount\([^,]+,\s*'([^'{}]+)'\s*,\s*'([^'{}]+)'/g
		)
	];
	for (const match of counts) {
		for (const key of [match[1], match[2]]) {
			const value = fr[key as keyof typeof fr];
			if (typeof value !== 'string' || value.includes('{count}')) continue;
			findings.push({
				file,
				line: content.slice(0, match.index).split('\n').length,
				rule: 'i18n-count-placeholder',
				detail: `formatCount key must include {count}: ${key}`
			});
		}
	}
}

const grouped = new Map<string, Finding[]>();
for (const finding of findings) {
	const list = grouped.get(finding.rule) ?? [];
	list.push(finding);
	grouped.set(finding.rule, list);
}

if (findings.length > 0) {
	for (const [rule, list] of grouped) {
		console.error(`\n${rule} (${list.length})`);
		for (const finding of list.slice(0, 20)) {
			console.error(
				`  ${relative(ROOT, finding.file)}:${finding.line} — ${finding.detail}`
			);
		}
		if (list.length > 20) console.error(`  … ${list.length - 20} more`);
	}
	console.error(`\nArchitecture verification failed: ${findings.length} finding(s).`);
	process.exit(1);
}

console.log(`Architecture verification passed (${sourceFiles.length} files).`);
