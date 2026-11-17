import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { branding } from '../src/lib/generated/branding.ts';
import { PRECACHE_LIMITS, precachePaths } from '../src/service-worker/precache.ts';

/**
 * Vérifie le graphe client après le build : les validateurs zod restent côté
 * serveur. Un seul marqueur suffit, parce que le runtime zod est reconnaissable
 * et ne doit jamais atteindre le navigateur.
 */
const root = path.join(process.cwd(), 'build/client/_app/immutable');

function javascriptFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const target = path.join(directory, entry.name);
		if (entry.isDirectory()) return javascriptFiles(target);
		return entry.isFile() && entry.name.endsWith('.js') ? [target] : [];
	});
}

function allFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const target = path.join(directory, entry.name);
		if (entry.isDirectory()) return allFiles(target);
		return entry.isFile() ? [target] : [];
	});
}

const files = javascriptFiles(root);
const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('ZodError'));

if (offenders.length > 0) {
	process.stderr.write(
		`zod atteint le navigateur dans ${offenders.length} morceau(x):\n${offenders
			.map((file) => `  ${path.relative(process.cwd(), file)}`)
			.join('\n')}\n`
	);
	process.exit(1);
}

const clientRoot = path.join(process.cwd(), 'build/client');
const immutablePaths = allFiles(path.join(clientRoot, '_app/immutable'))
	.map((file) => `/${path.relative(clientRoot, file).split(path.sep).join('/')}`)
	.filter((asset) => !asset.endsWith('.br') && !asset.endsWith('.gz'));
const precache = precachePaths(immutablePaths, branding);
const precacheBytes = precache
	.filter((asset) => asset.startsWith('/_app/'))
	.reduce((total, asset) => total + statSync(path.join(clientRoot, asset)).size, 0);

if (precacheBytes > PRECACHE_LIMITS.bytes) {
	process.stderr.write(
		`La coquille précachée pèse ${precacheBytes} octets pour un budget de ${PRECACHE_LIMITS.bytes}.\n`
	);
	process.exit(1);
}

process.stdout.write(
	`Bundle client vérifié (${files.length} morceaux, aucun zod, coquille précachée ${precacheBytes} octets).\n`
);
