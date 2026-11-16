import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'invalid-colour');

export const brandingSchema = z.object({
	name: z.string().min(1).max(80),
	shortName: z.string().min(1).max(12),
	organisation: z.string().min(1).max(80),
	description: z.string().min(1).max(200),
	locale: z.string().min(2).max(20),
	timezone: z.string().min(3).max(60),
	startUrl: z.string().startsWith('/'),
	scope: z.string().startsWith('/'),
	display: z.enum(['standalone', 'fullscreen', 'minimal-ui', 'browser']),
	indexable: z.boolean(),
	direction: z.enum(['ltr', 'rtl']),
	themeColor: hexColor,
	backgroundColor: hexColor,
	categories: z.array(z.string().min(1)).max(3),
	iconSource: z.string().min(1),
	socialImage: z.string().startsWith('/'),
	socialSource: z.string().min(1),
	icons: z.object({
		favicon: z.number().int().min(16).max(1024),
		appleTouch: z.number().int().min(16).max(1024),
		icon192: z.number().int().min(16).max(1024),
		icon512: z.number().int().min(16).max(1024),
		maskable: z.number().int().min(16).max(1024)
	}),
	maskableScale: z.number().min(0.5).max(1)
});

export type Branding = z.infer<typeof brandingSchema>;
