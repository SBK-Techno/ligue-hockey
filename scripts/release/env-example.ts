import { parseVersion } from './version.ts';

const IMAGE_LINE = /^LIGUE_IMAGE=ghcr\.io\/[^\s:]+:(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/gm;

function imageMatches(content: string): RegExpMatchArray[] {
	return [...content.matchAll(IMAGE_LINE)];
}

/**
 * Le suffixe de version de `LIGUE_IMAGE` est une surface générée depuis
 * `package.json`. Une seule ligne est autorisée : une copie ajoutée à la main
 * fait échouer la synchronisation et la vérification.
 */
export function syncEnvExample(content: string, version: string): string {
	parseVersion(version);
	const matches = imageMatches(content);
	if (matches.length !== 1) {
		throw new Error(
			`.env.example doit contenir exactement une ligne LIGUE_IMAGE avec une version, trouvé ${matches.length}.`
		);
	}
	return content.replace(IMAGE_LINE, (line) => `${line.slice(0, line.lastIndexOf(':'))}:${version}`);
}

export function envExampleVersion(content: string): string {
	const matches = imageMatches(content);
	if (matches.length !== 1) {
		throw new Error(
			`.env.example doit contenir exactement une ligne LIGUE_IMAGE avec une version, trouvé ${matches.length}.`
		);
	}
	const [, major, minor, patch] = matches[0];
	return `${major}.${minor}.${patch}`;
}
