import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { DATE_GLOB } from '#config/time.ts';
import {
	PAYMENT_METHOD_KEYS,
	type PaymentMethod
} from '#config/payment-methods.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { players } from '#lib/domain/players/schema.ts';

const METHOD_SQL = PAYMENT_METHOD_KEYS.map((key) => `'${key}'`).join(', ');

export const paymentPlans = sqliteTable(
	'payment_plans',
	{
		id: text('id').primaryKey(),
		playerId: text('player_id')
			.notNull()
			.references(() => players.userId, { onDelete: 'restrict' }),
		totalCents: integer('total_cents').notNull(),
		firstCents: integer('first_cents').notNull(),
		secondCents: integer('second_cents').notNull(),
		firstDueDate: text('first_due_date'),
		secondDueDate: text('second_due_date'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		uniqueIndex('payment_plans_player_unique').on(table.playerId),
		check('payment_plans_total_check', sql`${table.totalCents} >= 0`),
		check('payment_plans_first_check', sql`${table.firstCents} >= 0`),
		check('payment_plans_second_check', sql`${table.secondCents} >= 0`),
		check(
			'payment_plans_sum_check',
			sql`${table.firstCents} + ${table.secondCents} = ${table.totalCents}`
		),
		check(
			'payment_plans_dates_check',
			sql`${table.firstDueDate} is null or ${table.secondDueDate} is null or ${table.firstDueDate} < ${table.secondDueDate}`
		),
		check(
			'payment_plans_first_date_format',
			sql`${table.firstDueDate} is null or ${table.firstDueDate} glob '${sql.raw(DATE_GLOB)}'`
		),
		check(
			'payment_plans_second_date_format',
			sql`${table.secondDueDate} is null or ${table.secondDueDate} glob '${sql.raw(DATE_GLOB)}'`
		)
	]
);

export const payments = sqliteTable(
	'payments',
	{
		id: text('id').primaryKey(),
		playerId: text('player_id')
			.notNull()
			.references(() => players.userId, { onDelete: 'restrict' }),
		amountCents: integer('amount_cents').notNull(),
		paidAt: text('paid_at').notNull(),
		method: text('method').$type<PaymentMethod>().notNull(),
		note: text('note'),
		recordedBy: text('recorded_by').references(() => user.id, {
			onDelete: 'set null'
		}),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('payments_player_idx').on(table.playerId, table.paidAt),
		check('payments_amount_check', sql`${table.amountCents} > 0`),
		check(
			'payments_date_format',
			sql`${table.paidAt} glob '${sql.raw(DATE_GLOB)}'`
		),
		check('payments_method_check', sql.raw(`"method" in (${METHOD_SQL})`))
	]
);

export type PaymentPlanRow = typeof paymentPlans.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
