import type { Actor } from '#lib/domain/auth/types.ts';
import type { I18nKey } from '#config/i18n/fr.ts';

declare global {
	namespace App {
		interface Locals {
			actor: Actor;
			requestId: string;
			sessionId: string | null;
		}

		interface Error {
			message: string;
			status?: number;
			key?: I18nKey;
		}

		interface PageData {
			actor?: Actor;
			/** Le h1 d'une page de détail, composé par le résolveur de titre. */
			detailTitle?: string;
		}
	}
}

export {};
