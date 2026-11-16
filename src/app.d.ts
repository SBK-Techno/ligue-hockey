import type { Actor } from '#lib/domain/auth/types.ts';
import type { I18nKey } from '#config/i18n/fr.ts';

declare global {
	namespace App {
		interface Locals {
			actor: Actor;
			requestId: string;
		}

		interface Error {
			message: string;
			status?: number;
			key?: I18nKey;
		}

		interface PageData {
			actor?: Actor;
		}
	}
}

export {};
