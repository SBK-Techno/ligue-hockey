import { DEFAULT_ROLE, isRole, type Role } from '#config/roles.ts';

export type AnonymousActor = {
	kind: 'anonymous';
};

export type UserActor = {
	kind: 'user';
	userId: string;
	name: string;
	role: Role;
	/** Un compte de joueur désactivé n'agit plus, même avec un ancien cookie. */
	active: boolean;
};

export type Actor = AnonymousActor | UserActor;

export const anonymousActor: AnonymousActor = Object.freeze({
	kind: 'anonymous'
});

export type SessionUser = {
	id: string;
	name: string;
	role?: string | null;
	banned?: boolean | null;
	/** Absent when the caller has not resolved the player row yet. */
	active?: boolean | null;
};

export function actorFromUser(user: SessionUser | null | undefined): Actor {
	if (!user || user.banned || user.active === false) {
		return anonymousActor;
	}

	return {
		kind: 'user',
		userId: user.id,
		name: user.name,
		role: user.role && isRole(user.role) ? user.role : DEFAULT_ROLE,
		active: true
	};
}

export function isUserActor(actor: Actor): actor is UserActor {
	return actor.kind === 'user';
}
