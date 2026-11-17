import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { compressResponse, pickEncoding } from './compression.ts';

function request(acceptEncoding?: string): Request {
	return new Request('https://example.test/', {
		headers: acceptEncoding ? { 'accept-encoding': acceptEncoding } : {}
	});
}

async function bytesOf(response: Response): Promise<Buffer> {
	return Buffer.from(await response.arrayBuffer());
}

describe('négociation de compression', () => {
	it.each([
		['gzip', 'gzip'],
		['br', 'br'],
		['gzip, br', 'br'],
		['br;q=0.4, gzip;q=0.9', 'gzip'],
		['*', 'br'],
		['identity', null],
		[null, null]
	])('choisit %s', (header, expected) => {
		expect(pickEncoding(header)).toBe(expected);
	});
});

describe('compression des réponses', () => {
	it('compresse le HTML en gzip et pose Vary', async () => {
		const body = '<!doctype html><p>Bonjour</p>';
		const response = new Response(body, {
			headers: { 'content-type': 'text/html; charset=utf-8', etag: '"x"' }
		});

		const compressed = compressResponse(request('gzip'), response);

		expect(compressed.headers.get('content-encoding')).toBe('gzip');
		expect(compressed.headers.get('vary')).toContain('Accept-Encoding');
		expect(compressed.headers.has('etag')).toBe(false);
		expect(gunzipSync(await bytesOf(compressed)).toString()).toBe(body);
	});

	it('compresse le JSON en brotli', async () => {
		const body = JSON.stringify({ status: 'ok' });
		const response = new Response(body, {
			headers: { 'content-type': 'application/json' }
		});

		const compressed = compressResponse(request('br, gzip'), response);

		expect(compressed.headers.get('content-encoding')).toBe('br');
		expect(brotliDecompressSync(await bytesOf(compressed)).toString()).toBe(body);
	});

	it.each([
		['sans accept-encoding', request(), new Response('ok', { headers: { 'content-type': 'text/html' } })],
		['un type binaire', request('gzip'), new Response('ok', { headers: { 'content-type': 'image/webp' } })],
		[
			'déjà encodée',
			request('gzip'),
			new Response('ok', {
				headers: { 'content-type': 'text/html', 'content-encoding': 'br' }
			})
		],
		['un 204', request('gzip'), new Response(null, { status: 204 })]
	])('laisse intacte une réponse %s', (_name, req, response) => {
		expect(compressResponse(req as Request, response as Response)).toBe(response);
	});
});
