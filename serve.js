/**
 * Le seul point d'entrée de production, en conteneur comme en préversion.
 * L'adaptateur Node sert les fichiers et les pages; ce wrapper installe la
 * politique de cache des médias générés nommés par contenu avant l'écoute.
 * `node build` et `vite preview` ne sont pas supportés : ils servent les
 * mêmes fichiers sans cette politique.
 */
import { readFileSync } from 'node:fs';
import { server } from './build/index.js';
import { installStaticCachePolicy } from './scripts/lib/static-cache.js';

const manifest = JSON.parse(
	readFileSync(new URL('./build/client/generated-assets.json', import.meta.url), 'utf8')
);

installStaticCachePolicy(server, manifest);
