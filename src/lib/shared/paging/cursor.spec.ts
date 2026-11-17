import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.ts';

describe('curseur de discussion', () => {
	it('fait un aller-retour stable', () => {
		const cursor = { createdAt: 1794882526987, id: 'msg_2f1c' };
		expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
	});

	it.each([null, undefined, '', 'abc', '-1.msg', '1.', '1.2.3'])(
		'ignore un curseur invalide %s',
		(value) => {
			expect(decodeCursor(value)).toBeNull();
		}
	);
});
