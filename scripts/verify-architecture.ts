import { readFileSync, readdirSync, statSync } from 'node:fs';
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
