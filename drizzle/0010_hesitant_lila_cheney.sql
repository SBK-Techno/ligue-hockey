-- Identity backfill generated from config/identities.ts by
-- scripts/generate-identity-backfill.ts. Do not edit by hand.
--
-- Every active row keeps one stored identity allowed for its position. Invalid
-- ids, duplicates and legends outside the player's position are cleared, then
-- each position takes its free legends before the remaining rows take the free
-- league faces, in account-id order.
WITH catalogue(seq, id, position) AS (
  VALUES (1, 'capitaine-navy', NULL),
  (2, 'barbe-de-brique', NULL),
  (3, 'boucles-printanieres', NULL),
  (4, 'criniere-doree', NULL),
  (5, 'chignon-de-suede', NULL),
  (6, 'tete-rassee', NULL),
  (7, 'tuque-rouge', NULL),
  (8, 'masque-debutant', NULL),
  (9, 'casque-denim', NULL),
  (10, 'lunettes-de-bureau', NULL),
  (11, 'barbe-grise', NULL),
  (12, 'couettes-longues', NULL),
  (13, 'moustache-de-bronze', NULL),
  (14, 'masque-rouge', NULL),
  (15, 'frisettes-courtes', NULL),
  (16, 'chignon-dore', NULL),
  (17, 'lunettes-sport', NULL),
  (18, 'barbe-rousse', NULL),
  (19, 'casque-noir', NULL),
  (20, 'tete-nue', NULL),
  (21, 'longue-ondulation', NULL),
  (22, 'tuque-de-neige', NULL),
  (23, 'masque-veteran', NULL),
  (24, 'barbe-brune', NULL),
  (25, 'boucles-sombres', NULL),
  (26, 'casque-ardent', NULL),
  (27, 'masque-final', NULL),
  (28, 'chignon-de-nuit', NULL),
  (29, 'legende-plante', 'goalie'),
  (30, 'legende-dryden', 'goalie'),
  (31, 'legende-roy', 'goalie'),
  (32, 'legende-price', 'goalie'),
  (33, 'legende-harvey', 'defense'),
  (34, 'legende-savard', 'defense'),
  (35, 'legende-robinson', 'defense'),
  (36, 'legende-lapointe', 'defense'),
  (37, 'legende-markov', 'defense'),
  (38, 'legende-maurice-richard', 'forward'),
  (39, 'legende-beliveau', 'forward'),
  (40, 'legende-lafleur', 'forward'),
  (41, 'legende-henri-richard', 'forward'),
  (42, 'legende-koivu', 'forward'),
  (43, 'legende-laperriere', 'defense'),
  (44, 'legende-bouchard', 'defense'),
  (45, 'legende-chelios', 'defense'),
  (46, 'legende-subban', 'defense'),
  (47, 'legende-weber', 'defense'),
  (48, 'legende-tremblay', 'defense'),
  (49, 'legende-gainey', 'forward'),
  (50, 'legende-cournoyer', 'forward'),
  (51, 'legende-moore', 'forward'),
  (52, 'legende-geoffrion', 'forward'),
  (53, 'legende-blake', 'forward'),
  (54, 'legende-lach', 'forward'),
  (55, 'legende-lemaire', 'forward'),
  (56, 'legende-shutt', 'forward'),
  (57, 'legende-damphousse', 'forward'),
  (58, 'legende-morenz', 'forward'),
  (59, 'legende-vezina', 'goalie'),
  (60, 'legende-durnan', 'goalie'),
  (61, 'legende-johnson', 'defense'),
  (62, 'legende-talbot', 'defense'),
  (63, 'legende-langway', 'defense'),
  (64, 'legende-ludwig', 'defense'),
  (65, 'legende-brisebois', 'defense'),
  (66, 'legende-carbonneau', 'forward')
)
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
WITH catalogue(seq, id, position) AS (
  VALUES (1, 'capitaine-navy', NULL),
  (2, 'barbe-de-brique', NULL),
  (3, 'boucles-printanieres', NULL),
  (4, 'criniere-doree', NULL),
  (5, 'chignon-de-suede', NULL),
  (6, 'tete-rassee', NULL),
  (7, 'tuque-rouge', NULL),
  (8, 'masque-debutant', NULL),
  (9, 'casque-denim', NULL),
  (10, 'lunettes-de-bureau', NULL),
  (11, 'barbe-grise', NULL),
  (12, 'couettes-longues', NULL),
  (13, 'moustache-de-bronze', NULL),
  (14, 'masque-rouge', NULL),
  (15, 'frisettes-courtes', NULL),
  (16, 'chignon-dore', NULL),
  (17, 'lunettes-sport', NULL),
  (18, 'barbe-rousse', NULL),
  (19, 'casque-noir', NULL),
  (20, 'tete-nue', NULL),
  (21, 'longue-ondulation', NULL),
  (22, 'tuque-de-neige', NULL),
  (23, 'masque-veteran', NULL),
  (24, 'barbe-brune', NULL),
  (25, 'boucles-sombres', NULL),
  (26, 'casque-ardent', NULL),
  (27, 'masque-final', NULL),
  (28, 'chignon-de-nuit', NULL),
  (29, 'legende-plante', 'goalie'),
  (30, 'legende-dryden', 'goalie'),
  (31, 'legende-roy', 'goalie'),
  (32, 'legende-price', 'goalie'),
  (33, 'legende-harvey', 'defense'),
  (34, 'legende-savard', 'defense'),
  (35, 'legende-robinson', 'defense'),
  (36, 'legende-lapointe', 'defense'),
  (37, 'legende-markov', 'defense'),
  (38, 'legende-maurice-richard', 'forward'),
  (39, 'legende-beliveau', 'forward'),
  (40, 'legende-lafleur', 'forward'),
  (41, 'legende-henri-richard', 'forward'),
  (42, 'legende-koivu', 'forward'),
  (43, 'legende-laperriere', 'defense'),
  (44, 'legende-bouchard', 'defense'),
  (45, 'legende-chelios', 'defense'),
  (46, 'legende-subban', 'defense'),
  (47, 'legende-weber', 'defense'),
  (48, 'legende-tremblay', 'defense'),
  (49, 'legende-gainey', 'forward'),
  (50, 'legende-cournoyer', 'forward'),
  (51, 'legende-moore', 'forward'),
  (52, 'legende-geoffrion', 'forward'),
  (53, 'legende-blake', 'forward'),
  (54, 'legende-lach', 'forward'),
  (55, 'legende-lemaire', 'forward'),
  (56, 'legende-shutt', 'forward'),
  (57, 'legende-damphousse', 'forward'),
  (58, 'legende-morenz', 'forward'),
  (59, 'legende-vezina', 'goalie'),
  (60, 'legende-durnan', 'goalie'),
  (61, 'legende-johnson', 'defense'),
  (62, 'legende-talbot', 'defense'),
  (63, 'legende-langway', 'defense'),
  (64, 'legende-ludwig', 'defense'),
  (65, 'legende-brisebois', 'defense'),
  (66, 'legende-carbonneau', 'forward')
),
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
WITH catalogue(seq, id, position) AS (
  VALUES (1, 'capitaine-navy', NULL),
  (2, 'barbe-de-brique', NULL),
  (3, 'boucles-printanieres', NULL),
  (4, 'criniere-doree', NULL),
  (5, 'chignon-de-suede', NULL),
  (6, 'tete-rassee', NULL),
  (7, 'tuque-rouge', NULL),
  (8, 'masque-debutant', NULL),
  (9, 'casque-denim', NULL),
  (10, 'lunettes-de-bureau', NULL),
  (11, 'barbe-grise', NULL),
  (12, 'couettes-longues', NULL),
  (13, 'moustache-de-bronze', NULL),
  (14, 'masque-rouge', NULL),
  (15, 'frisettes-courtes', NULL),
  (16, 'chignon-dore', NULL),
  (17, 'lunettes-sport', NULL),
  (18, 'barbe-rousse', NULL),
  (19, 'casque-noir', NULL),
  (20, 'tete-nue', NULL),
  (21, 'longue-ondulation', NULL),
  (22, 'tuque-de-neige', NULL),
  (23, 'masque-veteran', NULL),
  (24, 'barbe-brune', NULL),
  (25, 'boucles-sombres', NULL),
  (26, 'casque-ardent', NULL),
  (27, 'masque-final', NULL),
  (28, 'chignon-de-nuit', NULL),
  (29, 'legende-plante', 'goalie'),
  (30, 'legende-dryden', 'goalie'),
  (31, 'legende-roy', 'goalie'),
  (32, 'legende-price', 'goalie'),
  (33, 'legende-harvey', 'defense'),
  (34, 'legende-savard', 'defense'),
  (35, 'legende-robinson', 'defense'),
  (36, 'legende-lapointe', 'defense'),
  (37, 'legende-markov', 'defense'),
  (38, 'legende-maurice-richard', 'forward'),
  (39, 'legende-beliveau', 'forward'),
  (40, 'legende-lafleur', 'forward'),
  (41, 'legende-henri-richard', 'forward'),
  (42, 'legende-koivu', 'forward'),
  (43, 'legende-laperriere', 'defense'),
  (44, 'legende-bouchard', 'defense'),
  (45, 'legende-chelios', 'defense'),
  (46, 'legende-subban', 'defense'),
  (47, 'legende-weber', 'defense'),
  (48, 'legende-tremblay', 'defense'),
  (49, 'legende-gainey', 'forward'),
  (50, 'legende-cournoyer', 'forward'),
  (51, 'legende-moore', 'forward'),
  (52, 'legende-geoffrion', 'forward'),
  (53, 'legende-blake', 'forward'),
  (54, 'legende-lach', 'forward'),
  (55, 'legende-lemaire', 'forward'),
  (56, 'legende-shutt', 'forward'),
  (57, 'legende-damphousse', 'forward'),
  (58, 'legende-morenz', 'forward'),
  (59, 'legende-vezina', 'goalie'),
  (60, 'legende-durnan', 'goalie'),
  (61, 'legende-johnson', 'defense'),
  (62, 'legende-talbot', 'defense'),
  (63, 'legende-langway', 'defense'),
  (64, 'legende-ludwig', 'defense'),
  (65, 'legende-brisebois', 'defense'),
  (66, 'legende-carbonneau', 'forward')
)
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
DROP TABLE identity_backfill_guard;
--> statement-breakpoint
CREATE UNIQUE INDEX `players_active_avatar_unique` ON `players` (`avatar_id`) WHERE "active" = 1 and "avatar_id" is not null;