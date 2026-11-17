import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

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

process.stdout.write(`Bundle client vérifié (${files.length} morceaux, aucun zod).\n`);
