import { t } from '#lib/shared/i18n/index.ts';

/**
 * Une demande comblée nomme la personne qui prend la place seulement quand le
 * service la connaît. Sinon la phrase reste vraie sans inventer un nom.
 */
export function filledRequestLabel(request: { filledByName: string | null }): string {
	return request.filledByName
		? t('home.absentRequestFilled', { name: request.filledByName })
		: t('home.absentRequestFilledUnknown');
}
