import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Transporter } from 'nodemailer';
import { listUserEmails } from '#lib/domain/notifications/queries.ts';
import type { RenderedNotification } from '#lib/domain/notifications/templates.ts';
import { renderEmailHtml, renderEmailText } from '#lib/server/notifications/email-html.ts';
import { env } from '#lib/shared/config/env.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import { clock } from '#lib/shared/time/clock.ts';

let transporter: Transporter | null = null;

async function transport(): Promise<Transporter> {
	if (transporter) return transporter;
	const smtp = env.smtp;
	if (!smtp) {
		throw new Error('SMTP is not configured');
	}
	const { createTransport } = await import('nodemailer');
	transporter = createTransport({
		host: smtp.host,
		port: smtp.port,
		secure: smtp.secure,
		auth:
			smtp.user && smtp.password
				? { user: smtp.user, pass: smtp.password }
				: undefined
	});
	return transporter;
}

function writeToOutbox(
	userId: string,
	message: RenderedNotification,
	email: string,
	html: string,
	text: string
): void {
	if (env.databaseUrl === ':memory:') {
		throw new Error('Email is not configured and no outbox is available');
	}

	const directory = join(dirname(env.databaseUrl), 'outbox');
	mkdirSync(directory, { recursive: true });
	const base = join(directory, `${clock.nowMs()}-${newId('mail')}`);
	const body = [
		`To: ${email}`,
		`Subject: ${message.title}`,
		'',
		text
	].join('\n');
	writeFileSync(`${base}.txt`, body, { mode: 0o600 });
	writeFileSync(`${base}.html`, html, { mode: 0o600 });
	logger.info('mail.outbox', { userId, file: `${base}.txt` });
}

export async function sendEmail(
	userId: string,
	message: RenderedNotification
): Promise<void> {
	const recipient = listUserEmails([userId])[0];
	if (!recipient) {
		throw new Error(`No email address for user ${userId}`);
	}

	const smtp = env.smtp;
	const html = renderEmailHtml(message.email, message.title, env.origin);
	const text = renderEmailText(message.email, env.origin);
	if (!smtp) {
		if (env.isProduction) {
			throw new Error('SMTP is not configured');
		}
		writeToOutbox(userId, message, recipient.email, html, text);
		return;
	}

	const sender = await transport();
	await sender.sendMail({
		from: smtp.from,
		to: recipient.email,
		subject: message.title,
		text,
		html
	});
	logger.info('mail.sent', { userId });
}
