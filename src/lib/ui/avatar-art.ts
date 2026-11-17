import type { AvatarArt } from '#config/avatars.ts';
import { identitySymbolId } from './identity-symbol.ts';

/**
 * Renders an avatar from the catalogue. The SVG contains only custom
 * properties from `tokens.css` and the player colour; no raw colour, no text
 * and no free-form data enter the string.
 */

const INK = 'var(--color-ink)';
const PAPER = 'var(--color-paper)';
const PAPER_DEEP = 'var(--color-paper-deep)';
const ACCENT = 'var(--color-accent)';
const ACCENT_DEEP = 'var(--color-accent-deep)';
const JERSEY = 'var(--player-color)';

const HEAD =
	'M 256 64 C 194 64 158 110 158 172 C 158 226 164 258 178 288 C 192 318 220 350 256 350 C 292 350 320 318 334 288 C 348 258 354 226 354 172 C 354 110 318 64 256 64 Z';
const BODY =
	'M 34 512 C 42 450 76 412 138 394 L 198 376 C 219 394 236 400 256 400 C 276 400 293 394 314 376 L 374 394 C 436 412 470 450 478 512 Z';

function hairBack(style: AvatarArt['style']): string {
	if (style === 'long') {
		return `<path d="M 150 176 C 142 260 146 320 152 352 L 186 352 C 172 300 170 236 176 178 Z" fill="h"/>
		        <path d="M 362 176 C 370 260 366 320 360 352 L 326 352 C 340 300 342 236 336 178 Z" fill="h"/>`;
	}
	if (style === 'bun') {
		return `<circle cx="256" cy="48" r="30" fill="h"/>`;
	}
	return '';
}

function hairFront(style: AvatarArt['style']): string {
	switch (style) {
		case 'bald':
			return '';
		case 'buzz':
			return `<path d="M 166 168 C 168 110 206 74 256 74 C 306 74 344 110 346 168 C 330 140 306 124 256 124 C 206 124 182 140 166 168 Z" fill="h"/>`;
		case 'curly':
			return `<path d="M 156 182 C 146 166 152 148 166 142 C 162 124 172 110 188 108 C 188 90 204 78 220 82 C 228 66 248 60 262 68 C 278 58 298 64 304 80 C 322 78 336 90 336 106 C 352 110 362 126 356 142 C 370 150 372 168 362 182 C 340 150 316 134 256 134 C 196 134 174 152 156 182 Z" fill="h"/>`;
		case 'long':
			return `<path d="M 158 176 C 158 104 200 64 256 64 C 312 64 354 104 354 176 C 338 146 318 130 296 126 C 274 122 238 132 214 152 C 196 166 176 182 158 176 Z" fill="h"/>`;
		case 'bun':
			return `<path d="M 160 174 C 158 104 200 66 256 66 C 312 66 354 104 352 174 C 334 144 312 130 256 130 C 200 130 178 144 160 174 Z" fill="h"/>`;
		case 'toque':
			return `<path d="M 148 186 C 146 112 194 62 256 62 C 318 62 366 112 364 186 Z" fill="${ACCENT}"/>
			        <rect x="144" y="172" width="224" height="40" rx="12" fill="${ACCENT_DEEP}"/>
			        <circle cx="256" cy="46" r="22" fill="${PAPER_DEEP}"/>`;
		case 'helmet':
			return `<path d="M 148 196 C 142 112 190 58 256 58 C 322 58 370 112 364 196 C 356 196 348 190 344 178 L 328 176 C 320 148 296 128 256 128 C 216 128 192 148 184 176 L 168 178 C 164 190 156 196 148 196 Z" fill="${INK}"/>`;
		default:
			return `<path d="M 158 176 C 158 104 200 64 256 64 C 312 64 354 104 354 176 C 338 146 318 130 296 126 C 272 120 236 132 212 152 C 194 166 176 182 158 176 Z" fill="h"/>`;
	}
}

function beard(style: AvatarArt['facial'], hair: string): string {
	if (style === 'none') return '';
	if (style === 'moustache') {
		return `<path d="M 228 272 C 240 264 272 264 284 272 C 276 280 236 280 228 272 Z" fill="${hair}"/>`;
	}
	if (style === 'stubble') {
		return `<path d="M 186 268 C 196 318 224 344 256 344 C 288 344 316 318 326 268 C 318 306 292 326 256 326 C 220 326 194 306 186 268 Z" fill="${hair}" opacity="0.28"/>`;
	}
	return `<path d="M 176 232 C 180 300 196 330 210 342 C 226 356 244 358 256 352 C 268 358 286 356 302 342 C 316 330 332 300 336 232 C 332 286 312 306 292 312 C 272 318 266 306 256 306 C 246 306 240 318 220 312 C 200 306 180 286 176 232 Z" fill="${hair}"/>`;
}

function mask(): string {
	return `<rect x="222" y="330" width="68" height="70" rx="16" fill="${PAPER}"/>
	<path d="M 256 66 C 196 66 162 112 162 176 C 162 232 168 262 182 292 C 196 322 222 352 256 352 C 290 352 316 322 330 292 C 344 262 350 232 350 176 C 350 112 316 66 256 66 Z" fill="${PAPER}"/>
	<path d="M 162 176 C 210 158 302 158 350 176 L 350 200 C 302 182 210 182 162 200 Z" fill="${ACCENT}" stroke="none"/>
	<g fill="${INK}" stroke="none">
		<rect x="196" y="214" width="52" height="26" rx="12"/>
		<rect x="264" y="214" width="52" height="26" rx="12"/>
	</g>
	<g fill="none" stroke-width="5">
		<path d="M 232 296 L 232 340"/><path d="M 256 300 L 256 348"/><path d="M 280 296 L 280 340"/>
		<path d="M 190 268 C 224 258 288 258 322 268"/>
		<path d="M 186 300 C 224 292 288 292 326 300"/>
	</g>`;
}

function art(variant: AvatarArt): string {
	const skin = `var(--color-avatar-skin-${variant.skin})`;
	const hair = `var(--color-avatar-hair-${variant.hair})`;
	const background = `var(--color-avatar-bg-${variant.bg})`;
	const masked = variant.style === 'mask';
	const mouth =
		variant.mouth === 'flat'
			? 'M 236 284 L 276 284'
			: variant.mouth === 'grin'
				? 'M 232 280 C 244 296 268 296 280 280 Z'
				: 'M 236 282 C 246 290 266 290 276 282';
	return `<rect width="512" height="512" fill="${background}"/>
  <g transform="translate(256 512) scale(1.08) translate(-256 -512)" stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    ${hairBack(variant.style).replaceAll('"h"', `"${hair}"`)}
    <path d="${BODY}" fill="${JERSEY}"/>
    <path d="M 44 470 C 60 424 96 400 140 392 L 200 374 C 220 392 236 398 256 398 C 276 398 292 392 312 374 L 372 392 C 416 400 452 424 468 470 C 400 440 320 436 256 436 C 192 436 112 440 44 470 Z" fill="${INK}" opacity="0.28" stroke-width="5"/>
    <rect x="228" y="312" width="56" height="86" fill="${skin}"/>
    <path d="${HEAD}" fill="${skin}"/>
    <path d="M 158 206 C 148 202 143 212 146 224 C 149 236 157 241 164 236 Z" fill="${skin}"/>
    <path d="M 354 206 C 364 202 369 212 366 224 C 363 236 355 241 348 236 Z" fill="${skin}"/>
    ${hairFront(variant.style).replaceAll('"h"', `"${hair}"`)}
    <path d="M 200 196 C 208 188 224 188 232 194" fill="none" stroke-width="9"/>
    <path d="M 280 194 C 288 188 304 188 312 196" fill="none" stroke-width="9"/>
    <ellipse cx="216" cy="214" rx="9" ry="11" fill="${INK}" stroke="none"/>
    <ellipse cx="296" cy="214" rx="9" ry="11" fill="${INK}" stroke="none"/>
    <path d="M 256 222 L 250 254 L 264 257" fill="none" stroke-width="6"/>
    <path d="${mouth}" fill="${variant.mouth === 'grin' ? INK : 'none'}" stroke-width="7"/>
    ${masked || variant.facial === 'none' ? '' : beard(variant.facial, hair)}
    ${masked || !variant.glasses ? '' : `<g fill="none" stroke-width="6"><rect x="188" y="196" width="60" height="38" rx="12"/><rect x="264" y="196" width="60" height="38" rx="12"/><path d="M 248 214 L 264 214"/><path d="M 188 210 L 172 206"/><path d="M 324 210 L 340 206"/></g>`}
    ${masked ? mask() : ''}
    <path d="M 198 376 C 219 394 236 400 256 400 C 276 400 293 394 314 376" fill="none" stroke="${PAPER}" stroke-width="14"/>
    <g stroke="${PAPER}" stroke-width="5" stroke-linecap="round">
      <path d="M 232 418 L 246 428"/><path d="M 256 420 L 256 434"/><path d="M 280 418 L 266 428"/>
    </g>
  </g>`;
}

/** Le contenu d'un symbole de la planche : aucune enveloppe `<svg>`. */
export function avatarSymbol(variant: AvatarArt): string {
	return `<symbol id="${identitySymbolId(variant.id)}" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid slice">${art(variant)}</symbol>`;
}
