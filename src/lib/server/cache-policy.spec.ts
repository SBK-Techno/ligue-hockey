import { describe, expect, it } from 'vitest';
import { cacheControlFor } from './cache-policy.ts';

const html = 'text/html; charset=utf-8';

describe('politique de cache', () => {
	const cases = [
		{
			name: 'garde la politique privée déclarée par la fiche de joueur',
			input: {
				pathname: '/api/joueurs/p1',
				hasSession: true,
				declared: 'private, max-age=15',
				contentType: 'application/json'
			},
			expected: null
		},
		{
			name: 'garde un no-store déclaré',
			input: {
				pathname: '/api/joueurs/p1',
				hasSession: true,
				declared: 'no-store',
				contentType: 'application/json'
			},
			expected: null
		},
		{
			name: 'ferme le HTML de session',
			input: {
				pathname: '/profil',
				hasSession: true,
				declared: null,
				contentType: html
			},
			expected: 'private, no-store'
		},
		{
			name: 'ferme le HTML anonyme de connexion',
			input: {
				pathname: '/connexion',
				hasSession: false,
				declared: null,
				contentType: html
			},
			expected: 'private, no-store'
		},
		{
			name: 'remplace une politique publique sur une réponse de session',
			input: {
				pathname: '/admin',
				hasSession: true,
				declared: 'public, max-age=60',
				contentType: html
			},
			expected: 'private, no-store'
		},
		{
			name: 'santé explicite',
			input: {
				pathname: '/api/health',
				hasSession: false,
				declared: 'public, max-age=300',
				contentType: 'application/json'
			},
			expected: 'no-store'
		},
		{
			name: 'réinitialisation explicite',
			input: {
				pathname: '/reinitialiser-mot-de-passe',
				hasSession: false,
				declared: null,
				contentType: html
			},
			expected: 'no-store'
		},
		{
			name: 'laisse un actif immuable au framework',
			input: {
				pathname: '/_app/immutable/app.js',
				hasSession: false,
				declared: 'public, max-age=31536000, immutable',
				contentType: 'text/javascript'
			},
			expected: null
		}
	] as const;

	for (const entry of cases) {
		it(entry.name, () => {
			expect(cacheControlFor(entry.input)).toBe(entry.expected);
		});
	}
});
