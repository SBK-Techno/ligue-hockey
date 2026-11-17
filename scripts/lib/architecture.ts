export type ArchitectureFile = {
	path: string;
	content: string;
};

export type QueryBoundaryAllowance = {
	/** Le fichier qui importe, chemin relatif à la racine. */
	file: string;
	/** Le module dont il lit les `queries.ts`. */
	module: string;
	reason: string;
};

export type BoundaryFinding = {
	file: string;
	line: number;
	rule: 'cross-module-query';
	detail: string;
};

const QUERY_IMPORT =
	/from ['"](?:#lib\/domain\/([a-z-]+)\/queries\.ts|(?:\.\.\/)+([a-z-]+)\/queries\.ts)['"]/;
const DOMAIN_FILE = /^src\/lib\/domain\/([a-z-]+)\//;

/**
 * La frontière d'écriture : un module appelle le service d'un autre module,
 * jamais ses `queries.ts`. Les seules exceptions sont les écritures qui
 * doivent partager la transaction de l'appelant; elles sont déclarées avec
 * leur raison, jamais devinées par le vérificateur.
 */
export function queryBoundaryFindings(
	files: readonly ArchitectureFile[],
	allowances: readonly QueryBoundaryAllowance[]
): BoundaryFinding[] {
	const allowed = new Set(
		allowances.map((entry) => `${entry.file}|${entry.module}`)
	);
	const findings: BoundaryFinding[] = [];

	for (const file of files) {
		if (!file.path.endsWith('.ts')) continue;
		if (file.path.includes('.spec.') || file.path.includes('.test.')) continue;
		const owner = DOMAIN_FILE.exec(file.path)?.[1];
		if (!owner) continue;

		for (const [index, line] of file.content.split('\n').entries()) {
			const match = QUERY_IMPORT.exec(line);
			if (!match) continue;
			const target = match[1] ?? match[2];
			if (!target || target === owner || target === AUDIT_QUERY_MODULE) continue;
			if (allowed.has(`${file.path}|${target}`)) continue;
			findings.push({
				file: file.path,
				line: index + 1,
				rule: 'cross-module-query',
				detail: `${owner} lit ${target}/queries.ts; passe par ${target}/service.ts ou déclare l'exception de transaction.`
			});
		}
	}

	return findings;
}

/**
 * Les exceptions déclarées. L'audit est transverse : chaque écriture le pose
 * dans sa transaction. Les autres exceptions sont propres au fichier et
 * portent leur raison.
 */
export const QUERY_BOUNDARY_ALLOWANCES: readonly QueryBoundaryAllowance[] = [
	{
		file: 'src/lib/domain/games/queries.ts',
		module: 'ratings',
		reason: 'La purge des notes des joueurs retirés partage la transaction de l’alignement.'
	},
	{
		file: 'src/lib/domain/players/service.ts',
		module: 'auth',
		reason: 'Le changement de rôle écrit la ligne BetterAuth et son audit dans la même transaction.'
	},
	{
		file: 'src/lib/domain/subs/service.ts',
		module: 'auth',
		reason: 'La liste des destinataires d’une capacité se lit dans la même transaction de notification.'
	}
];

export const AUDIT_QUERY_MODULE = 'audit';
