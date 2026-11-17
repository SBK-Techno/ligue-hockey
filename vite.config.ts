import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { CRITICAL_STYLE_HASH } from './src/lib/generated/critical-style.ts';

export default defineConfig({
	server: {
		watch: {
			ignored: ['**/data/**']
		}
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				// Les îlots paresseux rendent leur contenu au serveur : le navigateur
				// ne reçoit que le morceau qu'il doit hydrater, jamais le graphe complet.
				experimental: { async: true }
			},
			// SvelteKit applique ce seuil à la feuille entière, pas à une tranche.
			// La tranche critique est donc explicite dans src/lib/ui/critical.css
			// et injectée par la coquille; la feuille complète reste un lien.
			inlineStyleThreshold: 0,
			// Les URL d'actifs restent absolues : le CSS inliné est partagé par
			// toutes les routes, y compris les routes imbriquées.
			paths: { relative: false },
			// CSP native de SvelteKit : les scripts et styles générés reçoivent
			// un nonce par réponse. Les attributs `style="..."` du produit
			// (jetons de glace, gabarits) restent autorisés explicitement.
			csp: {
				mode: 'nonce',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', CRITICAL_STYLE_HASH],
					'style-src-attr': ['unsafe-inline'],
					'img-src': ['self', 'data:'],
					'font-src': ['self'],
					'connect-src': ['self'],
					'manifest-src': ['self'],
					'media-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			},
			adapter: adapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.spec.ts'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.client.spec.ts']
				}
			},
			{
				extends: './vite.config.ts',
				// Le montage d'un composant exige la version client de Svelte; le
				// projet serveur garde la résolution Node par défaut.
				resolve: { conditions: ['browser'] },
				test: {
					name: 'client',
					environment: 'happy-dom',
					include: ['src/**/*.client.spec.ts']
				}
			}
		]
	}
});
