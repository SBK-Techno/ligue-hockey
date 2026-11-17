import { z } from 'zod';

/**
 * Politique de version : seule source des règles de montée de version.
 * Le plan de publication lit ce schéma; aucun script ne redéfinit un seuil.
 */
export const releasePolicySchema = z.object({
	tagPrefix: z.literal('v'),
	branch: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
	defaultBump: z.enum(['major', 'minor', 'patch']),
	minorTypes: z.array(z.string().min(1)).min(1),
	ignoreTypes: z.array(z.string().min(1)),
	breakingMarkers: z.array(z.string().min(1)).min(1)
});

export type ReleasePolicy = z.infer<typeof releasePolicySchema>;

export const RELEASE_POLICY = releasePolicySchema.parse({
	tagPrefix: 'v',
	branch: 'release/next',
	defaultBump: 'patch',
	minorTypes: ['feat'],
	ignoreTypes: ['chore', 'docs', 'test', 'ci', 'build', 'style'],
	breakingMarkers: ['BREAKING CHANGE', 'BREAKING-CHANGE']
});
