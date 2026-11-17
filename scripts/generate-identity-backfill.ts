import { IDENTITY_IDS, legendForIdentity } from '#config/identities.ts';

/**
 * Builds the SQL block that gives every active player one stored identity
 * before the partial unique index exists.
 *
 * The identity catalogue in `config/identities.ts` is the only source: this
 * script never lists an identity id or a legend position itself. Each legend
 * carries the position it played, and the block enforces the same rule as
 * `identityAllowedForPosition`: a league face fits every position, a legend
 * fits only its own. The one path that writes many identities at once cannot
 * persist a legend outside the player's position.
 */

function quote(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function catalogueValues(): string {
	return IDENTITY_IDS.map((identityId, index) => {
		const legend = legendForIdentity(identityId);
		const position = legend ? quote(legend.position) : 'NULL';
		return `(${index + 1}, ${quote(identityId)}, ${position})`;
	}).join(',\n  ');
}

function catalogue(): string {
	return `catalogue(seq, id, position) AS (
  VALUES ${catalogueValues()}
)`;
}

export function identityBackfillSql(): string {
	return `-- Identity backfill generated from config/identities.ts by
-- scripts/generate-identity-backfill.ts. Do not edit by hand.
--
-- Every active row keeps one stored identity allowed for its position. Invalid
-- ids, duplicates and legends outside the player's position are cleared, then
-- each position takes its free legends before the remaining rows take the free
-- league faces, in account-id order.
WITH ${catalogue()}
UPDATE players
SET avatar_id = NULL
WHERE active = 1
  AND avatar_id IS NOT NULL
  AND (
    avatar_id NOT IN (SELECT id FROM catalogue)
    OR user_id <> (
      SELECT MIN(keeper.user_id)
      FROM players keeper
      WHERE keeper.active = 1
        AND keeper.avatar_id = players.avatar_id
    )
    OR avatar_id IN (
      SELECT id FROM catalogue
      WHERE position IS NOT NULL AND position <> players.position
    )
  );
--> statement-breakpoint
WITH ${catalogue()},
used AS (
  SELECT avatar_id AS id
  FROM players
  WHERE active = 1 AND avatar_id IS NOT NULL
),
free_legends AS (
  SELECT id, position, ROW_NUMBER() OVER (PARTITION BY position ORDER BY seq) AS ordinal
  FROM catalogue
  WHERE position IS NOT NULL AND id NOT IN (SELECT id FROM used)
),
free_faces AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY seq) AS ordinal
  FROM catalogue
  WHERE position IS NULL AND id NOT IN (SELECT id FROM used)
),
needed AS (
  SELECT user_id, position, ROW_NUMBER() OVER (PARTITION BY position ORDER BY user_id) AS ordinal
  FROM players
  WHERE active = 1 AND avatar_id IS NULL
),
legend_assignment AS (
  SELECT needed.user_id, free_legends.id
  FROM needed
  JOIN free_legends
    ON free_legends.position = needed.position
    AND free_legends.ordinal = needed.ordinal
),
legend_count AS (
  SELECT position, COUNT(*) AS count
  FROM free_legends
  GROUP BY position
),
face_needed AS (
  SELECT needed.user_id, ROW_NUMBER() OVER (ORDER BY needed.position, needed.user_id) AS ordinal
  FROM needed
  LEFT JOIN legend_count ON legend_count.position = needed.position
  WHERE needed.ordinal > COALESCE(legend_count.count, 0)
),
face_assignment AS (
  SELECT face_needed.user_id, free_faces.id
  FROM face_needed
  JOIN free_faces ON free_faces.ordinal = face_needed.ordinal
)
UPDATE players
SET avatar_id = COALESCE(
  (SELECT id FROM legend_assignment WHERE legend_assignment.user_id = players.user_id),
  (SELECT id FROM face_assignment WHERE face_assignment.user_id = players.user_id)
)
WHERE active = 1 AND avatar_id IS NULL;
--> statement-breakpoint
-- An active row without an identity, or with a legend outside its position,
-- cannot migrate: the guard fails instead of persisting a mismatch.
CREATE TEMP TABLE identity_backfill_guard (
  ok INTEGER NOT NULL CHECK (ok = 1)
);
--> statement-breakpoint
WITH ${catalogue()}
INSERT INTO identity_backfill_guard (ok)
SELECT CASE
  WHEN EXISTS (
    SELECT 1
    FROM players
    WHERE active = 1
      AND (
        avatar_id IS NULL
        OR avatar_id NOT IN (SELECT id FROM catalogue)
        OR avatar_id IN (
          SELECT id FROM catalogue
          WHERE position IS NOT NULL AND position <> players.position
        )
      )
  )
  THEN 0
  ELSE 1
END;
--> statement-breakpoint
DROP TABLE identity_backfill_guard;`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	process.stdout.write(`${identityBackfillSql()}\n`);
}
