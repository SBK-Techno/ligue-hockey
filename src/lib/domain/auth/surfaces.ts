import { SURFACES, type Surface } from '#config/surfaces.ts';
import { can } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';

export function visibleSurfaces(actor: Actor): readonly Surface[] {
  return SURFACES.filter((surface) =>
    surface.capabilities.some((capability) => can(actor, capability))
  );
}

export function primarySurfaces(actor: Actor): readonly Surface[] {
  return visibleSurfaces(actor).filter((surface) => surface.placement === 'primary');
}

export function accountSurfaces(actor: Actor): readonly Surface[] {
  return visibleSurfaces(actor).filter((surface) => surface.placement === 'account');
}
