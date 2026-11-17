import { Readable } from 'node:stream';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';

/**
 * Le contrat de compression du serveur : toute réponse HTML ou JSON destinée à
 * un client qui l'accepte sort compressée, avec `Vary: Accept-Encoding`. Les
 * actifs statiques ont déjà leurs jumeaux précompressés dans le serveur
 * d'adaptateur; ce module ne les voit donc jamais.
 *
 * `application/manifest+json` n'est pas listé : le manifeste est un fichier
 * statique servi avant les hooks. L'adaptateur ne précompresse que les
 * extensions `.html`, `.js`, `.json`, `.css`, `.svg`, `.xml`, `.wasm`, `.txt`
 * et `.md`; un `.webmanifest` de 844 octets reste donc en identité. Le lister
 * ici laisserait croire à une compression que ce module ne peut pas faire.
 */
export type CompressionEncoding = 'br' | 'gzip';

const COMPRESSIBLE = new Set([
	'text/html',
	'application/json',
	'text/plain',
	'text/css',
	'application/javascript',
	'text/javascript',
	'image/svg+xml'
]);

function codingWeight(header: string, coding: string): number | null {
	for (const part of header.toLowerCase().split(',')) {
		const [name, ...params] = part.split(';');
		if (name.trim() !== coding) continue;
		for (const param of params) {
			const [key, value] = param.split('=');
			if (key.trim() === 'q') return Number.parseFloat(value) || 0;
		}
		return 1;
	}
	return null;
}

/** Choisit le meilleur encodage accepté, ou null si aucun ne l'est. */
export function pickEncoding(acceptEncoding: string | null): CompressionEncoding | null {
	if (!acceptEncoding) return null;
	const wildcard = codingWeight(acceptEncoding, '*');
	const br = codingWeight(acceptEncoding, 'br') ?? wildcard;
	const gzip = codingWeight(acceptEncoding, 'gzip') ?? wildcard;
	if (br !== null && br > 0 && (gzip === null || br >= gzip)) return 'br';
	if (gzip !== null && gzip > 0) return 'gzip';
	return null;
}

function isCompressible(contentType: string | null): boolean {
	if (!contentType) return false;
	return COMPRESSIBLE.has(contentType.split(';')[0].trim().toLowerCase());
}

function withVary(existing: string | null, value: string): string {
	const parts = (existing ?? '')
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	if (!parts.some((part) => part.toLowerCase() === value.toLowerCase())) {
		parts.push(value);
	}
	return parts.join(', ');
}

function compressedBody(body: ReadableStream, encoding: CompressionEncoding): ReadableStream {
	const source = Readable.fromWeb(
		body as unknown as import('node:stream/web').ReadableStream
	);
	const compressor =
		encoding === 'br'
			? createBrotliCompress({
					params: { [constants.BROTLI_PARAM_QUALITY]: 5 }
				})
			: createGzip({ level: 6 });
	return Readable.toWeb(source.pipe(compressor)) as unknown as ReadableStream;
}

/**
 * Retourne la réponse originale quand rien ne doit être compressé, sinon une
 * nouvelle réponse qui garde le statut et les en-têtes, sans `Content-Length`
 * ni `ETag` devenus faux pour la représentation encodée.
 */
export function compressResponse(request: Request, response: Response): Response {
	if (response.body === null || response.status === 204 || response.status === 304) {
		return response;
	}
	if (response.headers.has('content-encoding')) return response;
	if (!isCompressible(response.headers.get('content-type'))) return response;

	const encoding = pickEncoding(request.headers.get('accept-encoding'));
	if (!encoding) return response;

	const headers = response.headers;
	headers.delete('content-length');
	headers.delete('etag');
	headers.set('content-encoding', encoding);
	headers.set('vary', withVary(headers.get('vary'), 'Accept-Encoding'));

	return new Response(compressedBody(response.body, encoding), {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
