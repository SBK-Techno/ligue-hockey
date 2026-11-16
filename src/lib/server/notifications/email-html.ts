import { branding } from '#lib/generated/branding.ts';
import { t } from '#lib/shared/i18n/index.ts';
import type { EmailView } from '#lib/domain/notifications/templates.ts';

const { ink: INK, paper: PAPER, surface: SURFACE, line: LINE, muted: MUTED, brand: BRAND } =
	branding.emailPalette;

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function safeUrl(value: string, origin: string): string {
	try {
		const url = new URL(value, origin);
		if (url.protocol !== 'https:' && url.protocol !== 'http:') {
			return new URL('/', origin).toString();
		}
		return url.toString();
	} catch {
		return new URL('/', origin).toString();
	}
}

export function renderEmailText(email: EmailView, origin: string): string {
	const actionUrl = safeUrl(email.actionUrl, origin);
	const lines: string[] = [];
	if (email.greeting) lines.push(email.greeting, '');
	lines.push(...email.paragraphs.flatMap((paragraph) => [paragraph, '']));
	lines.push(`${email.actionLabel}: ${actionUrl}`, '');
	if (email.note) lines.push(email.note, '');
	lines.push(
		email.ignore ?? t('email.unsubscribe'),
		'',
		t('email.footer.league'),
		t('email.footer.organisation'),
		origin,
		''
	);
	return lines.join('\n');
}

export function renderEmailHtml(
	email: EmailView,
	subject: string,
	origin: string
): string {
	const iconUrl = safeUrl(branding.icons.icon192, origin);
	const actionUrl = safeUrl(email.actionUrl, origin);
	const preferencesUrl = safeUrl('/profil#notifications', origin);
	const leagueName = escapeHtml(branding.name);
	const organisation = escapeHtml(branding.organisation);
	const heading = escapeHtml(email.heading);
	const preheader = escapeHtml(email.paragraphs[0] ?? subject);

	const greeting = email.greeting
		? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK};">${escapeHtml(email.greeting)}</p>`
		: '';

	const paragraphs = email.paragraphs
		.map(
			(paragraph) =>
				`<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK};">${escapeHtml(paragraph)}</p>`
		)
		.join('');

	const note = email.note
		? `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${MUTED};">${escapeHtml(email.note)}</p>`
		: '';

	const footerNote = email.ignore
		? `<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${MUTED};">${escapeHtml(email.ignore)}</p>`
		: `<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${MUTED};">${escapeHtml(
				t('email.unsubscribe')
			)} <a href="${escapeHtml(preferencesUrl)}" style="color:${BRAND};text-decoration:underline;">${escapeHtml(
				t('email.manage')
			)}</a></p>`;

	return `<!doctype html>
<html lang="${escapeHtml(branding.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr>
<td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${SURFACE};border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
<tr>
<td style="background:${INK};padding:20px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding-right:12px;">
<img src="${escapeHtml(iconUrl)}" width="44" height="44" alt="" style="display:block;border-radius:11px;">
</td>
<td>
<p style="margin:0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;line-height:1.3;color:${PAPER};">${leagueName}</p>
<p style="margin:2px 0 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;line-height:1.3;color:${PAPER};opacity:0.62;">${organisation}</p>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:32px 32px 8px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<h1 style="margin:0 0 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;color:${INK};">${heading}</h1>
${greeting}
${paragraphs}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr>
<td style="border-radius:10px;background:${BRAND};">
<a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 24px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.2;color:${SURFACE};text-decoration:none;">${escapeHtml(
		email.actionLabel
	)}</a>
</td>
</tr>
</table>
${note}
<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${MUTED};">${escapeHtml(
		t('email.fallback')
	)}</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;"><a href="${escapeHtml(
		actionUrl
	)}" style="color:${BRAND};text-decoration:underline;">${escapeHtml(actionUrl)}</a></p>
</td>
</tr>
<tr>
<td style="padding:24px 32px 28px;border-top:1px solid ${LINE};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${footerNote}
<p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">${escapeHtml(
		t('email.footer.league')
	)} · ${escapeHtml(t('email.footer.organisation'))}</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}
