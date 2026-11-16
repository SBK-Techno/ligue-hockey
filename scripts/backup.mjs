import Database from 'better-sqlite3';

const sourcePath = process.env.DATABASE_URL ?? './data/ligue.db';
const targetPath = process.argv[2] ?? './data/backup.db';
const source = new Database(sourcePath, { readonly: true });

try {
	await source.backup(targetPath);
	process.stdout.write(`Backup written to ${targetPath}\n`);
} finally {
	source.close();
}
