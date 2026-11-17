import { describe, expect, it } from 'vitest';
import {
	QUERY_BOUNDARY_ALLOWANCES,
	queryBoundaryFindings,
	routeBoundaryFindings,
	type ArchitectureFile
} from './architecture.ts';

function file(path: string, content: string): ArchitectureFile {
	return { path, content };
}

describe('frontière des requêtes entre modules', () => {
	it('refuse une lecture de queries.ts d’un autre module sans exception', () => {
		const findings = queryBoundaryFindings(
			[
				file(
					'src/lib/domain/games/service.ts',
					"import { listGoals } from '#lib/domain/gamesheet/queries.ts';"
				),
				file(
					'src/lib/domain/games/deep/service.ts',
					"import { findPlayer } from '../../players/queries.ts';"
				)
			],
			[]
		);

		expect(findings).toHaveLength(2);
		expect(findings[0]).toEqual(
			expect.objectContaining({
				file: 'src/lib/domain/games/service.ts',
				line: 1,
				rule: 'cross-module-query'
			})
		);
		expect(findings[1]).toEqual(
			expect.objectContaining({
				file: 'src/lib/domain/games/deep/service.ts',
				line: 1
			})
		);
	});

	it('accepte une exception déclarée et l’audit transverse', () => {
		const findings = queryBoundaryFindings(
			[
				file(
					'src/lib/domain/games/queries.ts',
					"import { deleteGameRatingsForPlayers } from '#lib/domain/ratings/queries.ts';"
				),
				file(
					'src/lib/domain/chat/queries.ts',
					"import { insertAudit } from '#lib/domain/audit/queries.ts';"
				)
			],
			QUERY_BOUNDARY_ALLOWANCES
		);

		expect(findings).toEqual([]);
	});

	it('refuse une lecture de queries.ts d’un autre module depuis src/lib/server', () => {
		const findings = queryBoundaryFindings(
			[
				file(
					'src/lib/server/notifications/email.ts',
					"import { findPlayer } from '#lib/domain/players/queries.ts';"
				),
				file(
					'src/lib/server/notifications/push.ts',
					"import { listUserEmails } from '#lib/domain/notifications/queries.ts';"
				)
			],
			[]
		);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toEqual(
			expect.objectContaining({
				file: 'src/lib/server/notifications/email.ts',
				line: 1,
				rule: 'cross-module-query'
			})
		);
	});

	it('ne regarde ni le même module ni les tests', () => {
		const findings = queryBoundaryFindings(
			[
				file(
					'src/lib/domain/games/service.ts',
					"import { listGames } from './queries.ts';"
				),
				file(
					'src/lib/domain/games/service.spec.ts',
					"import { listGoals } from '#lib/domain/gamesheet/queries.ts';"
				)
			],
			[]
		);

		expect(findings).toEqual([]);
	});
});

describe('frontière des routes', () => {
	it('refuse le fournisseur d’authentification dans une route', () => {
		const findings = routeBoundaryFindings([
			file(
				'src/routes/deconnexion/+server.ts',
				"import { auth } from '#lib/server/auth.ts';"
			),
			file(
				'src/routes/profil/+page.server.ts',
				"import { betterAuthIdentity } from '../../lib/server/auth/identity.ts';"
			)
		]);

		expect(findings).toHaveLength(2);
		expect(findings[0]).toEqual(
			expect.objectContaining({
				file: 'src/routes/deconnexion/+server.ts',
				line: 1,
				rule: 'route-provider-import'
			})
		);
	});

	it('accepte le service d’authentification et les composants de route', () => {
		const findings = routeBoundaryFindings([
			file(
				'src/routes/deconnexion/+server.ts',
				"import { signOut } from '#lib/domain/auth/service.ts';"
			),
			file(
				'src/lib/server/auth/identity.ts',
				"import { auth } from '#lib/server/auth.ts';"
			)
		]);

		expect(findings).toEqual([]);
	});
});
