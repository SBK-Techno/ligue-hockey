import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/auth.schema.ts';

export function listAdminUserIds(): string[] {
	return db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, 'admin'))
		.all()
		.map((row) => row.id);
}
