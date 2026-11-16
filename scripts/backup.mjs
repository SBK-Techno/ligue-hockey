import { chmodSync } from 'node:fs';
import Database from 'better-sqlite3';

// Ce script tourne dans l'image de production, sans configuration TypeScript.
// Il refuse de deviner une base ou une cible : le déploiement fournit les deux.
const sourcePath = process.env.DATABASE_URL;
const targetPath = process.argv[2];

if (!sourcePath) {
	process.stderr.write('DATABASE_URL est requis pour sauvegarder la base.\n');
	process.exit(1);
}
if (!targetPath) {
	process.stderr.write('Usage: node scripts/backup.mjs <fichier-de-sortie>\n');
	process.exit(1);
}

const source = new Database(sourcePath, { readonly: true });

try {
	await source.backup(targetPath);
	chmodSync(targetPath, 0o600);
	process.stdout.write(`Backup written to ${targetPath}\n`);
} finally {
	source.close();
}
