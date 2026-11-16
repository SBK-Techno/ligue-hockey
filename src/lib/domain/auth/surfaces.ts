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

/**
 * La barre mobile garde cinq places. Gestion passe avant le profil pour un
 * responsable, donc l'administration reste à un tap de n'importe quel écran.
 */
export function mobileSurfaces(actor: Actor): readonly Surface[] {
  return [...primarySurfaces(actor)]
    .sort((a, b) => a.mobilePriority - b.mobilePriority)
    .slice(0, 5);
}
