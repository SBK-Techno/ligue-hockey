<script lang="ts">
	import { rinkRole, type RinkRoleDefinition } from '#config/rink.ts';
	import { TEAMS, teamDefinition, type Team } from '#config/teams.ts';
	import { branding } from '#lib/generated/branding.ts';
	import type { GameBenchView, GameSlotView } from '#lib/domain/games/types.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import {
		assignmentsForSave,
		initialAssignments,
		placeFromBench,
		removePlayer,
	slotKey,
	swapPlayers,
	type LineupAssignmentMap
} from './lineup-board.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	type BoardPlayer = {
		playerId: string;
		fullName: string;
		jerseyNumber: number | null;
	};

	type Placement = {
		key: string;
		team: Team;
		position: GameSlotView['position'];
		slotIndex: number;
		role: RinkRoleDefinition | null;
	};

	let {
		slots,
		bench,
		canEdit,
		expectedGeneratedAt
	}: {
		slots: readonly GameSlotView[];
		bench: readonly GameBenchView[];
		canEdit: boolean;
		expectedGeneratedAt: number | null;
	} = $props();

	const placements = $derived.by<Placement[]>(() =>
		slots.map((slot) => ({
			key: slotKey(slot),
			team: slot.team,
			position: slot.position,
			slotIndex: slot.slotIndex,
			role: rinkRole(slot.position, slot.slotIndex)
		}))
	);

	// La carte est remontée quand la génération change; l'état initial est stable.
	// svelte-ignore state_referenced_locally
	let assignments = $state<LineupAssignmentMap>(initialAssignments(slots));
	let selected = $state<string | null>(null);
	// svelte-ignore state_referenced_locally
	const initialJson = JSON.stringify(initialAssignments(slots));
	const dirty = $derived(JSON.stringify(assignments) !== initialJson);

	const players = $derived.by<BoardPlayer[]>(() => {
		const list: BoardPlayer[] = [];
		for (const slot of slots) {
			if (!slot.player || list.some((entry) => entry.playerId === slot.player?.playerId)) continue;
			list.push({
				playerId: slot.player.playerId,
				fullName: slot.player.fullName,
				jerseyNumber: slot.player.jerseyNumber
			});
		}
		for (const entry of bench) {
			if (list.some((player) => player.playerId === entry.playerId)) continue;
			list.push({
				playerId: entry.playerId,
				fullName: entry.fullName,
				jerseyNumber: entry.jerseyNumber
			});
		}
		return list;
	});

	const placedIds = $derived(
		Object.values(assignments).filter((value): value is string => value !== null)
	);
	const benchPlayers = $derived(
		players.filter((player) => !placedIds.includes(player.playerId))
	);

	const assignmentsJson = $derived(JSON.stringify(assignmentsForSave(slots, assignments)));

	function playerAt(key: string): BoardPlayer | null {
		const playerId = assignments[key];
		return playerId ? (players.find((player) => player.playerId === playerId) ?? null) : null;
	}

	function selectSlot(key: string) {
		if (!canEdit) return;
		if (selected === key) {
			selected = null;
			return;
		}
		if (selected === null) {
			selected = assignments[key] ? key : null;
			return;
		}
		if (selected.startsWith('bench:')) {
			choosePlace(selected.slice(6), key);
			return;
		}
		swap(selected, key);
	}

	function choosePlace(playerId: string, target: string) {
		assignments = placeFromBench(assignments, playerId, target);
		selected = null;
	}

	function swap(from: string, to: string) {
		assignments = swapPlayers(assignments, from, to);
		selected = null;
	}

	function selectBench(playerId: string) {
		if (!canEdit) return;
		selected = selected === `bench:${playerId}` ? null : `bench:${playerId}`;
	}

	function removeSelected() {
		if (!selected || selected.startsWith('bench:')) return;
		assignments = removePlayer(assignments, selected);
		selected = null;
	}

	function reset() {
		assignments = initialAssignments(slots);
		selected = null;
	}
</script>

<section class="mt-4 space-y-4">
	<p class="text-meta text-muted">
		{canEdit ? t('rink.helpManager') : t('rink.helpPlayer')}
	</p>

	<div class="grid gap-4 lg:grid-cols-2">
		{#each TEAMS as team (team.key)}
			<div class="min-w-0">
				<div class="mb-2 flex items-baseline justify-between gap-2">
					<h3 class="text-subhead font-semibold">{t(teamDefinition(team.key).labelKey)}</h3>
					<span class="text-caption text-muted">
						{team.key === 'black' ? t('rink.attackLeft') : t('rink.attackRight')}
					</span>
				</div>
				<div class="rink" style="--rink-texture: url({branding.textures.ice})">
					{#each placements.filter((placement) => placement.team === team.key) as placement (placement.key)}
						{#if placement.role}
							{@const player = playerAt(placement.key)}
							<button
								type="button"
								class="rink-token"
								style="--x: {team.key === 'black' ? placement.role.y : 100 - placement.role.y}%; --y: {placement.role.x}%"
								data-team={team.key}
								data-player-id={player?.playerId}
								data-filled={player !== null}
								data-selected={selected === placement.key}
								disabled={!canEdit && player === null}
								data-player-peek={!canEdit && player ? 'click' : undefined}
								onclick={() => selectSlot(placement.key)}
								aria-label={player
									? `${t(teamDefinition(team.key).labelKey)}, ${t(placement.role.labelKey)} · ${player.jerseyNumber ?? ''} ${player.fullName}`
									: `${t(teamDefinition(team.key).labelKey)}, ${t(placement.role.labelKey)} · ${t('rink.emptySlot')}`}
								aria-pressed={canEdit ? selected === placement.key : undefined}
							>
								{#if player}
									<span class="rink-number">{player.jerseyNumber ?? '?'}</span>
									<span class="rink-name">{player.fullName.split(' ').at(-1)}</span>
								{:else}
									<span class="rink-empty">+</span>
								{/if}
							</button>
						{/if}
					{/each}
				</div>

				{#if placements.some((placement) => placement.team === team.key && !placement.role)}
					<ul role="list" class="mt-2 flex flex-wrap gap-1.5">
						{#each placements.filter((placement) => placement.team === team.key && !placement.role) as placement (placement.key)}
							{@const player = playerAt(placement.key)}
							{#if player}
								<li class="badge">
									{player.jerseyNumber ?? ''} {player.fullName}
								</li>
							{/if}
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</div>

	{#if benchPlayers.length > 0}
		<div>
			<h3 class="text-subhead font-semibold">{t('rink.bench')}</h3>
			<ul role="list" class="mt-2 flex flex-wrap gap-1.5">
				{#each benchPlayers as player (player.playerId)}
					<li>
						<button
							type="button"
							class="bench-chip"
							data-player-id={player.playerId}
							data-player-peek={!canEdit ? 'click' : undefined}
							data-selected={selected === `bench:${player.playerId}`}
							onclick={() => selectBench(player.playerId)}
							aria-pressed={selected === `bench:${player.playerId}`}
						>
							<span class="font-mono text-caption text-muted">{player.jerseyNumber ?? '?'}</span>
							{player.fullName}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if canEdit && selected}
		<div class="flex flex-wrap items-center gap-2 border-t border-line pt-3" role="status">
			{#if selected.startsWith('bench:')}
				<p class="text-meta text-muted">{t('rink.choosePlace')}</p>
			{:else}
				<p class="text-meta text-muted">{t('rink.chooseOther')}</p>
				<button class="btn-ghost btn-sm" type="button" onclick={removeSelected}>
					{t('rink.remove')}
				</button>
			{/if}
			<button class="btn-ghost btn-sm ml-auto" type="button" onclick={() => (selected = null)}>
				{t('common.cancel')}
			</button>
		</div>
	{/if}

	{#if canEdit}
		<form method="POST" action="?/lineup" use:progressiveForm class="flex flex-wrap items-center gap-2">
			<input type="hidden" name="lineup" value={assignmentsJson} />
			<input
				type="hidden"
				name="expectedGeneratedAt"
				value={expectedGeneratedAt === null ? '' : String(expectedGeneratedAt)}
			/>
			<button class="btn-primary" type="submit" disabled={!dirty}>{t('rink.save')}</button>
			{#if dirty}
				<button class="btn-ghost btn-sm" type="button" onclick={reset}>
					{t('rink.reset')}
				</button>
			{/if}
		</form>
	{/if}
</section>
