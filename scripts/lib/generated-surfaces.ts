/**
 * Les surfaces écrites par `scripts/generate.ts`. Le générateur refuse un
 * fichier qui n'est déclaré ici, et `docs:check` exige que chacune soit
 * nommée dans `ARCHITECTURE.md`. Une nouvelle sortie ne peut donc pas rester
 * invisible pour la documentation ni pour la revue.
 */
export type GeneratedSurface = {
	/** Le préfixe ou le chemin exact écrit par le générateur. */
	path: string;
	/** La forme attendue dans `ARCHITECTURE.md`; c'est le même texte. */
	docs: string;
	label: string;
};

export const GENERATED_SURFACES: readonly GeneratedSurface[] = [
	{ path: 'src/app.html', docs: 'src/app.html', label: 'coquille HTML' },
	{
		path: 'src/lib/generated/branding.ts',
		docs: 'src/lib/generated/branding.ts',
		label: 'module de marque'
	},
	{
		path: 'src/lib/generated/critical-style.ts',
		docs: 'src/lib/generated/critical-style.ts',
		label: 'empreinte de la tranche critique'
	},
	{
		path: 'static/manifest.webmanifest',
		docs: 'static/manifest.webmanifest',
		label: 'manifeste'
	},
	{ path: 'static/robots.txt', docs: 'static/robots.txt', label: 'robots' },
	{ path: 'static/offline.html', docs: 'static/offline.html', label: 'page hors ligne' },
	{
		path: 'static/generated-assets.json',
		docs: 'static/generated-assets.json',
		label: 'manifeste de checksums'
	},
	{ path: 'static/icons/', docs: 'static/icons/', label: 'icônes' },
	{ path: 'static/auth/', docs: 'static/auth/', label: 'photo de connexion' },
	{ path: 'static/textures/', docs: 'static/textures/', label: 'tuiles de texture' },
	{
		path: 'static/identities/',
		docs: 'static/identities/',
		label: 'planche d’identités'
	},
	{ path: 'static/social/', docs: 'static/social/', label: 'image sociale' }
];

export function generatedSurfaceFor(path: string): GeneratedSurface | undefined {
	return GENERATED_SURFACES.find((surface) =>
		surface.path.endsWith('/') ? path.startsWith(surface.path) : path === surface.path
	);
}

export function assertDeclaredSurfaces(paths: readonly string[]): void {
	const undeclared = paths.filter((path) => generatedSurfaceFor(path) === undefined);
	if (undeclared.length > 0) {
		throw new Error(
			`Surface générée non déclarée dans scripts/lib/generated-surfaces.ts: ${undeclared.join(', ')}`
		);
	}
}
