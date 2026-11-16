import { branding } from '#lib/generated/branding.ts';
import { requirePermission, requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { renameDefaultLocation } from '#lib/domain/settings/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { clock, todayInZone } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import {
	deleteLocationIfUnused,
	findLocation,
	findLocationByName,
	insertLocation,
	listLocationMetrics as readLocationMetrics,
	listLocationRows,
	updateLocation as updateLocationRow,
	type LocationMetricsRow
} from './queries.ts';
import type { LocationRow } from './schema.ts';
import {
	locationDeleteSchema,
	locationInputSchema,
	locationUpdateSchema,
	type LocationInput
} from './validators.ts';

export type LocationView = {
	id: string;
	name: string;
	address: string | null;
	mapUrl: string | null;
	notes: string | null;
};

export type { LocationMetricsRow as LocationMetrics };

function toView(row: LocationRow): LocationView {
	return {
		id: row.id,
		name: row.name,
		address: row.address,
		mapUrl: row.mapUrl,
		notes: row.notes
	};
}

function requireLocation(id: string): LocationRow {
	const row = findLocation(id);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'admin.locationNotFound' });
	}
	return row;
}

function ensureNameAvailable(name: string, exceptId?: string): void {
	const existing = findLocationByName(name);
	if (existing && existing.id !== exceptId) {
		throw new AppError('CONFLICT', { key: 'admin.locationExists' });
	}
}

function isUniqueConstraint(cause: unknown): boolean {
	return (cause as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE';
}

function isForeignKeyConstraint(cause: unknown): boolean {
	return (cause as { code?: string }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY';
}

export function listLocations(actor: Actor): LocationView[] {
	requirePermission(actor, 'manageGames');
	return listLocationRows().map(toView);
}

export function getLocation(actor: Actor, id: string): LocationView {
	requirePermission(actor, 'manageGames');
	return toView(requireLocation(id));
}

/** Les détails d'un lieu sont publics pour un membre, mais seule la gestion les modifie. */
export function getLocationDetails(actor: Actor, id: string): LocationView {
	requireUser(actor);
	return toView(requireLocation(id));
}

export function createLocation(actor: Actor, input: LocationInput): LocationView {
	requirePermission(actor, 'manageGames');
	const parsed = parseSchema(locationInputSchema, input);
	ensureNameAvailable(parsed.name);

	const id = newId('location');
	const now = clock.nowMs();
	try {
		insertLocation({
			id,
			name: parsed.name,
			address: parsed.address,
			mapUrl: parsed.mapUrl,
			notes: parsed.notes,
			createdAt: now,
			updatedAt: now
		});
	} catch (cause) {
		if (isUniqueConstraint(cause)) {
			throw new AppError('CONFLICT', { key: 'admin.locationExists', cause });
		}
		throw cause;
	}

	recordAudit(actor, {
		action: 'location.create',
		entityType: 'location',
		entityId: id,
		metadata: { name: parsed.name }
	});

	return toView(requireLocation(id));
}

export function updateLocation(actor: Actor, input: LocationInput & { id: string }): LocationView {
	requirePermission(actor, 'manageGames');
	const parsed = parseSchema(locationUpdateSchema, input);
	const previous = requireLocation(parsed.id);
	ensureNameAvailable(parsed.name, parsed.id);

	try {
		updateLocationRow(
			parsed.id,
			{
				name: parsed.name,
				address: parsed.address,
				mapUrl: parsed.mapUrl,
				notes: parsed.notes
			},
			clock.nowMs()
		);
	} catch (cause) {
		if (isUniqueConstraint(cause)) {
			throw new AppError('CONFLICT', { key: 'admin.locationExists', cause });
		}
		throw cause;
	}

	if (previous.name !== parsed.name) {
		renameDefaultLocation(actor, previous.name, parsed.name);
	}

	recordAudit(actor, {
		action: 'location.update',
		entityType: 'location',
		entityId: parsed.id,
		metadata: { name: parsed.name }
	});

	return toView(requireLocation(parsed.id));
}

export function deleteLocation(actor: Actor, input: { id: string }): void {
	requirePermission(actor, 'manageGames');
	const parsed = parseSchema(locationDeleteSchema, input);
	const removed = requireLocation(parsed.id);

	let deleted: boolean;
	try {
		deleted = deleteLocationIfUnused(parsed.id);
	} catch (cause) {
		if (isForeignKeyConstraint(cause)) {
			throw new AppError('CONFLICT', { key: 'admin.locationInUse', cause });
		}
		throw cause;
	}
	if (!deleted) {
		throw new AppError('CONFLICT', { key: 'admin.locationInUse' });
	}

	renameDefaultLocation(actor, removed.name, '');

	recordAudit(actor, {
		action: 'location.delete',
		entityType: 'location',
		entityId: parsed.id
	});
}

export function listLocationMetrics(actor: Actor): LocationMetricsRow[] {
	requirePermission(actor, 'manageGames');
	const today = todayInZone(branding.timezone, clock.nowMs());
	return readLocationMetrics(today);
}
