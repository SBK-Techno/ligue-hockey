import { describe, expect, it } from 'vitest';
import {
	chatPositionKey,
	clearChatPosition,
	parseChatPosition,
	readChatPosition,
	writeChatPosition
} from './chat-position.ts';

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		values,
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => void values.set(key, value),
		removeItem: (key: string) => void values.delete(key)
	};
}

describe('position de lecture', () => {
	it('porte l’identifiant du membre dans sa clé', () => {
		expect(chatPositionKey('alice')).not.toBe(chatPositionKey('bob'));
		expect(chatPositionKey('alice')).toContain('alice');
	});

	it('relit la position écrite pour le même membre', () => {
		const storage = memoryStorage();
		const position = { messageId: 'msg_12', offset: -18, savedAt: 1_700_000_000_000 };

		expect(writeChatPosition('alice', position, storage)).toBe(true);
		expect(readChatPosition('alice', storage)).toEqual(position);
		expect(readChatPosition('bob', storage)).toBeNull();
	});

	it('refuse une position mal formée sans casser la page', () => {
		expect(parseChatPosition('pas du json')).toBeNull();
		expect(parseChatPosition('{"messageId":"","offset":0,"savedAt":1}')).toBeNull();
		expect(parseChatPosition('{"messageId":"a","offset":1e9,"savedAt":1}')).toBeNull();
		expect(parseChatPosition('{"messageId":"a","offset":0,"savedAt":0}')).toBeNull();
		expect(parseChatPosition(null)).toBeNull();
	});

	it('efface la position du membre sans toucher aux autres', () => {
		const storage = memoryStorage();
		writeChatPosition('alice', { messageId: 'a', offset: 0, savedAt: 1 }, storage);
		writeChatPosition('bob', { messageId: 'b', offset: 0, savedAt: 1 }, storage);

		clearChatPosition('alice', storage);

		expect(readChatPosition('alice', storage)).toBeNull();
		expect(readChatPosition('bob', storage)?.messageId).toBe('b');
	});

	it('refuse une écriture après l’effacement, sans fermer les autres membres', () => {
		const storage = memoryStorage();
		const position = { messageId: 'a', offset: 0, savedAt: 1 };
		writeChatPosition('carol', position, storage);

		clearChatPosition('carol', storage);

		expect(writeChatPosition('carol', { ...position, messageId: 'b' }, storage)).toBe(false);
		expect(readChatPosition('carol', storage)).toBeNull();
		expect(writeChatPosition('dave', position, storage)).toBe(true);
		expect(readChatPosition('dave', storage)?.messageId).toBe('a');
	});

	it('reste best-effort quand le stockage refuse', () => {
		const broken = {
			getItem: () => {
				throw new Error('refusé');
			},
			setItem: () => {
				throw new Error('refusé');
			},
			removeItem: () => {
				throw new Error('refusé');
			}
		};

		expect(readChatPosition('alice', broken)).toBeNull();
		expect(
			writeChatPosition('alice', { messageId: 'a', offset: 0, savedAt: 1 }, broken)
		).toBe(false);
		expect(() => clearChatPosition('alice', broken)).not.toThrow();
	});

	it('survit à un accès au stockage local qui lève', () => {
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			get() {
				throw new Error('bloqué');
			}
		});
		try {
			expect(readChatPosition('blocked')).toBeNull();
			expect(
				writeChatPosition('blocked', { messageId: 'a', offset: 0, savedAt: 1 })
			).toBe(false);
			expect(() => clearChatPosition('blocked')).not.toThrow();
		} finally {
			if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
			else Reflect.deleteProperty(globalThis, 'localStorage');
		}
	});
});
