<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import { rinkGeometryStyle } from '#config/rink.ts';
	import {
		orderedTeams as teamsInOrder,
		TEAMS,
		teamDefinition,
		type Team
	} from '#config/teams.ts';
	import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import Avatar from '#lib/ui/Avatar.svelte';
	import TeamRoster from '#lib/ui/TeamRoster.svelte';
	import {
		assignmentsAllowed,
		assignmentsForSave,
		benchKey,
		benchPlayerId,
		boardPlacements,
		canPlacePlayer,
		clearSelectedPlace,
		dropOnPlace,
		initialAssignments,
		placementRules,
		rinkPlayerLastName,
		rinkRoleShortLabel,
		selectBenchPlayer,
		selectPlace,
		slotAriaLabel,
		viewerSpot,
		type LineupAssignmentMap,
		type LineupPlacement
	} from './lineup-board.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	type BoardPlayer = {
		playerId: string;
		fullName: string;
		position: GamePlayer['position'];
		jerseyNumber: number | null;
		avatarId: string | null;
		kind: GamePlayer['kind'];
	};

	type DragSession = {
		key: string;
		pointerId: number;
		pointerType: string;
		startX: number;
		startY: number;
		x: number;
		y: number;
		dragging: boolean;
		draggable: boolean;
		fromSlot: boolean;
	};

	let {
		slots,
		bench,
		canEdit,
		expectedGeneratedAt,
		actorId = null,
		ownTeam = null
	}: {
		slots: readonly GameSlotView[];
		bench: readonly GamePlayer[];
		canEdit: boolean;
		expectedGeneratedAt: number | null;
		actorId?: string | null;
		ownTeam?: Team | null;
	} = $props();

	const placements = $derived.by<LineupPlacement[]>(() => boardPlacements(slots));
	const orderedTeams = $derived(teamsInOrder(ownTeam));
	// svelte-ignore state_referenced_locally
	let activeTeam = $state<Team>(ownTeam ?? TEAMS[0].key);

	// La carte est remontée quand la génération change; l'état initial est stable.
	// svelte-ignore state_referenced_locally
	let assignments = $state<LineupAssignmentMap>(initialAssignments(slots));
	let selected = $state<string | null>(null);
	let history = $state<LineupAssignmentMap[]>([]);
	let drag = $state<DragSession | null>(null);
	let hoverKey = $state<string | null>(null);
	let benchHover = $state(false);
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
				position: slot.player.position,
				jerseyNumber: slot.player.jerseyNumber,
				avatarId: slot.player.avatarId,
				kind: slot.player.kind
			});
		}
		for (const entry of bench) {
			if (list.some((player) => player.playerId === entry.playerId)) continue;
			list.push({
				playerId: entry.playerId,
				fullName: entry.fullName,
				position: entry.position,
				jerseyNumber: entry.jerseyNumber,
				avatarId: entry.avatarId,
				kind: entry.kind
			});
		}
		return list;
	});

	/**
	 * The same position table drives rendering, hover and drops. The server
	 * already rejects a player outside their position, so the board never
	 * offers a gesture that would fail on save.
	 */
	const rules = $derived(placementRules(slots, players));

	const placedIds = $derived(
		Object.values(assignments).filter((value): value is string => value !== null)
	);
	const benchPlayers = $derived(
		players.filter((player) => !placedIds.includes(player.playerId))
	);
	const selectedPlayer = $derived.by(() => (selected ? playerOf(selected) : null));
	const selectedIsBench = $derived(
		selected !== null && benchPlayerId(selected) !== null
	);
	const draggedPlayer = $derived.by(() => (drag ? playerOf(drag.key) : null));

	const assignmentsJson = $derived(JSON.stringify(assignmentsForSave(slots, assignments)));
	const geometryStyle = rinkGeometryStyle();

	/**
	 * La liste de la formation suit les gestes en cours, pas seulement la
	 * formation publiée : un gérant qui déplace un joueur voit la liste changer
	 * sous ses doigts.
	 */
	const rosterSlots = $derived.by<GameSlotView[]>(() =>
		placements.map((placement) => {
			const playerId = assignments[placement.key] ?? null;
			const player = playerId ? playerById(playerId) : null;
			return {
				team: placement.team,
				position: placement.position,
				slotIndex: placement.slotIndex,
				player: player
					? {
							playerId: player.playerId,
							fullName: player.fullName,
							position: player.position,
							jerseyNumber: player.jerseyNumber,
							avatarId: player.avatarId,
							kind: player.kind
						}
					: null
			};
		})
	);

	/**
	 * Le résumé du joueur suit les gestes en cours : déplacer son propre jeton
	 * met « Ton poste » à jour avant même d'enregistrer.
	 */
	const viewer = $derived(viewerSpot(rosterSlots, benchPlayers, actorId));
	const viewerSummary = $derived.by(() => {
		if (!viewer) return null;
		if (viewer.kind === 'bench') {
			return {
				title: null,
				text: t('home.teamBench'),
				help: t('home.teamBenchHelp')
			};
		}
		if (viewer.kind === 'absent') {
			return {
				title: null,
				text: t('home.teamNoSlot'),
				help: t('home.teamNoSlotHelp')
			};
		}
		const parts = [
			t(teamDefinition(viewer.team).labelKey),
			t(positionDefinition(viewer.position).labelKey)
		];
		if (viewer.line !== null) parts.push(t('rink.line', { line: viewer.line }));
		else if (viewer.pair !== null) parts.push(t('rink.pair', { pair: viewer.pair }));
		else if (viewer.role === null) {
			parts.push(t('rink.extraSlot', { index: viewer.slotIndex + 1 }));
		}
		return { title: t('rink.yourSpot'), text: parts.join(' · '), help: null };
	});

	/**
	 * Le guide suit un seul chemin : choisir un joueur, choisir sa place,
	 * enregistrer. Après un déplacement, les deux premiers gestes sont faits.
	 */
	const stepOne = $derived(selected !== null || dirty ? 'done' : 'active');
	const stepTwo = $derived(
		selected !== null ? 'active' : dirty ? 'done' : 'todo'
	);
	const stepThree = $derived(dirty ? 'active' : 'todo');

	function playerById(playerId: string): BoardPlayer | null {
		return players.find((player) => player.playerId === playerId) ?? null;
	}

	function playerAt(key: string): BoardPlayer | null {
		const playerId = assignments[key];
		return playerId ? playerById(playerId) : null;
	}

	function playerOf(key: string): BoardPlayer | null {
		const benchId = benchPlayerId(key);
		return benchId !== null ? playerById(benchId) : playerAt(key);
	}

	/** Le portrait partage le rendu de tous les avatars de l'application. */
	function portrait(player: BoardPlayer) {
		return {
			fullName: player.fullName,
			userId: player.playerId,
			avatarId: player.avatarId
		};
	}

	function isViewer(playerId: string): boolean {
		return actorId !== null && actorId === playerId;
	}

	/** Le nom accessible annonce « Toi » quand la place est celle du joueur. */
	function ariaWithYou(label: string, player: BoardPlayer): string {
		return isViewer(player.playerId) ? `${label}, ${t('common.you')}` : label;
	}

	/**
	 * Chaque mutation passe par ici : l'historique garde au plus vingt états,
	 * et un geste sans effet ne crée ni entrée ni changement.
	 */
	function commit(next: LineupAssignmentMap) {
		if (!assignmentsAllowed(rules, next)) return;
		if (JSON.stringify(next) === JSON.stringify(assignments)) return;
		history = [...history.slice(-19), assignments];
		assignments = next;
	}

	/** A slot only accepts the selected player's position. */
	function canTarget(key: string): boolean {
		return (
			selectedPlayer === null ||
			canPlacePlayer(rules, selectedPlayer.playerId, key)
		);
	}

	function activateKey(key: string) {
		if (!canEdit) return;
		const benchId = benchPlayerId(key);
		if (benchId !== null) {
			selected = selectBenchPlayer({ selected, assignments }, benchId).selected;
			return;
		}
		const next = selectPlace({ selected, assignments }, key, rules);
		commit(next.assignments);
		selected = next.selected;
	}

	function removeSelected() {
		const next = clearSelectedPlace({ selected, assignments });
		commit(next.assignments);
		selected = next.selected;
	}

	function undo() {
		const previous = history.at(-1);
		if (!previous) return;
		history = history.slice(0, -1);
		assignments = previous;
		selected = null;
	}

	function reset() {
		if (!dirty) return;
		commit(initialAssignments(slots));
		selected = null;
	}

	/** La clé de ligne la plus proche du pointeur, ou null hors d'une cible. */
	function lineupKeyAt(target: EventTarget | null): string | null {
		const element = target instanceof Element ? target : null;
		return element?.closest<HTMLElement>('[data-lineup-key]')?.dataset.lineupKey ?? null;
	}

	function beginPointer(event: PointerEvent) {
		if (!canEdit || event.button !== 0) return;
		const key = lineupKeyAt(event.target);
		if (!key) return;
		const player = playerOf(key);
		const touch = event.pointerType === 'touch';
		drag = {
			key,
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			startX: event.clientX,
			startY: event.clientY,
			x: event.clientX,
			y: event.clientY,
			dragging: false,
			/* Au toucher, le geste reste un toucher : la page doit pouvoir
			   défiler. Le déplacement se fait en deux touchers. */
			draggable: !touch && player !== null,
			fromSlot: benchPlayerId(key) === null
		};
		if (!touch) {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		}
	}

	function movePointer(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dx = event.clientX - drag.startX;
		const dy = event.clientY - drag.startY;

		if (drag.pointerType === 'touch') {
			/* Un doigt qui glisse fait défiler la page, jamais un échange. */
			if (Math.hypot(dx, dy) > 12) drag = null;
			return;
		}

		if (!drag.dragging && Math.hypot(dx, dy) < 8) {
			drag = { ...drag, x: event.clientX, y: event.clientY };
			return;
		}
		if (!drag.draggable) return;

		drag = { ...drag, dragging: true, x: event.clientX, y: event.clientY };
		const under = document.elementFromPoint(event.clientX, event.clientY);
		const key = lineupKeyAt(under);
		hoverKey =
			key === drag.key || (key !== null && !canTarget(key)) ? null : key;
		benchHover = Boolean(
			drag.fromSlot && under?.closest('[data-bench-drop]')
		);
		if (benchHover) hoverKey = null;
	}

	function endPointer(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const session = drag;
		drag = null;
		const element = event.currentTarget as HTMLElement;
		if (element.hasPointerCapture(event.pointerId)) {
			element.releasePointerCapture(event.pointerId);
		}

		if (session.dragging) {
			if (benchHover && session.fromSlot) {
				const next = clearSelectedPlace({ selected: session.key, assignments });
				commit(next.assignments);
				selected = next.selected;
			} else if (hoverKey && hoverKey !== session.key) {
				const next = dropOnPlace(
					{ selected: session.key, assignments },
					hoverKey,
					rules
				);
				commit(next.assignments);
				selected = next.selected;
			}
			hoverKey = null;
			benchHover = false;
			return;
		}

		activateKey(session.key);
	}

	function cancelPointer(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		drag = null;
		hoverKey = null;
		benchHover = false;
	}

	/** Un clic sans pointeur vient du clavier ou d'un lecteur d'écran. */
	function handleClick(event: MouseEvent, key: string) {
		if (event.detail !== 0 || !canEdit) return;
		event.preventDefault();
		activateKey(key);
	}
</script>

<!-- Les pointeurs sont délégués au conteneur : chaque cible réelle reste un
     bouton, et le glisser-déposer est une amélioration, pas le seul chemin. -->
<section
	class="lineup-board mt-4 space-y-4"
	class:lineup-board-dragging={drag?.dragging}
	role="group"
	aria-labelledby="alignement-titre"
	data-dragging={drag?.dragging ?? false}
	onpointerdown={beginPointer}
	onpointermove={movePointer}
	onpointerup={endPointer}
	onpointercancel={cancelPointer}
>
	<h2 id="alignement-titre" class="sr-only">{t('rink.board')}</h2>

	{#if viewerSummary}
		<div class="you-spot">
			{#if viewerSummary.title}
				<span class="stamp border-ice bg-ice-soft text-ice-deep">{viewerSummary.title}</span>
			{/if}
			<div class="min-w-0">
				<p class="text-body font-semibold">{viewerSummary.text}</p>
				{#if viewerSummary.help}
					<p class="hint mt-0.5">{viewerSummary.help}</p>
				{/if}
			</div>
		</div>
	{/if}

	{#if canEdit}
		<div>
			<p class="sr-only">{t('rink.steps')}</p>
			<ol class="lineup-steps">
				<li data-state={stepOne} aria-current={stepOne === 'active' ? 'step' : undefined}>
					<span class="step-mark" aria-hidden="true">1</span>
					<span>{t('rink.stepPick')}</span>
					<span class="sr-only">
						{stepOne === 'done' ? t('rink.stepDone') : t('rink.stepActive')}
					</span>
				</li>
				<li data-state={stepTwo} aria-current={stepTwo === 'active' ? 'step' : undefined}>
					<span class="step-mark" aria-hidden="true">2</span>
					<span>{t('rink.stepPlace')}</span>
					<span class="sr-only">
						{stepTwo === 'done'
							? t('rink.stepDone')
							: stepTwo === 'active'
								? t('rink.stepActive')
								: t('rink.stepTodo')}
					</span>
				</li>
				<li
					data-state={stepThree}
					aria-current={stepThree === 'active' ? 'step' : undefined}
				>
					<span class="step-mark" aria-hidden="true">3</span>
					<span>{t('rink.stepSave')}</span>
					<span class="sr-only">
						{stepThree === 'active' ? t('rink.stepActive') : t('rink.stepTodo')}
					</span>
				</li>
			</ol>
		</div>
	{/if}

	<p class="text-meta text-muted">
		{canEdit ? t('rink.helpManager') : t('rink.helpPlayer')}
	</p>

	<div class="rink-switch" role="group" aria-label={t('rink.chooseTeam')}>
		{#each orderedTeams as team (team.key)}
			<button
				type="button"
				class="chip justify-center"
				aria-pressed={activeTeam === team.key}
				aria-controls="rink-team-{team.key}"
				onclick={() => (activeTeam = team.key)}
			>
				{t(teamDefinition(team.key).shortLabelKey)}
				{#if ownTeam === team.key}
					<span class="sr-only"> · {t('home.team')}</span>
				{/if}
			</button>
		{/each}
	</div>

	<div class="rink-teams">
		{#each orderedTeams as team (team.key)}
			<div
				class="rink-team min-w-0"
				id="rink-team-{team.key}"
				data-active={activeTeam === team.key}
			>
				<div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
					<div class="flex min-w-0 items-baseline gap-2">
						<h3 class="text-subhead font-semibold">{t(teamDefinition(team.key).labelKey)}</h3>
						{#if ownTeam === team.key}
							<span class="stamp border-ice bg-ice-soft text-ice-deep">{t('home.team')}</span>
						{/if}
					</div>
					<span class="text-caption text-muted">
						{team.key === 'black' ? t('rink.attackLeft') : t('rink.attackRight')}
					</span>
				</div>
				<div class="rink" style={geometryStyle}>
					{#each placements.filter((placement) => placement.team === team.key) as placement (placement.key)}
						{#if placement.role}
							{@const player = playerAt(placement.key)}
							<button
								type="button"
								class="rink-token"
								style="--x: {team.key === 'black' ? placement.role.y : 100 - placement.role.y}%; --y: {placement.role.x}%"
								data-team={team.key}
								data-player-id={player?.playerId}
								data-lineup-key={placement.key}
								data-filled={player !== null}
								data-you={player !== null && isViewer(player.playerId)}
								data-selected={selected === placement.key}
								data-drag-source={drag?.dragging && drag.key === placement.key}
								data-drop-active={hoverKey === placement.key}
								data-awaiting={canEdit &&
									selected !== null &&
									selected !== placement.key &&
									canTarget(placement.key)}
								data-ineligible={canEdit && selected !== null && !canTarget(placement.key)}
								disabled={(!canEdit && player === null) ||
									(canEdit &&
										selected !== null &&
										!canTarget(placement.key) &&
										player === null)}
								data-player-peek={!canEdit && player ? 'click' : undefined}
								onclick={(event) => handleClick(event, placement.key)}
								aria-label={player ? ariaWithYou(slotAriaLabel(team.key, placement, player), player) : slotAriaLabel(team.key, placement, null)}
								aria-haspopup={!canEdit && player ? 'dialog' : undefined}
								aria-expanded={!canEdit && player ? 'false' : undefined}
								aria-pressed={canEdit && player ? selected === placement.key : undefined}
							>
								{#if player}
									<span class="rink-face">
										<span class="rink-portrait">
											<Avatar player={portrait(player)} fill />
										</span>
										<span class="rink-number">{player.jerseyNumber ?? '?'}</span>
									</span>
									<span class="rink-name">{rinkPlayerLastName(player.fullName)}</span>
								{:else}
									<span class="rink-face">
										<span class="rink-portrait rink-empty">{rinkRoleShortLabel(placement.role)}</span>
									</span>
								{/if}
							</button>
						{/if}
					{/each}
				</div>

				{#if placements.some((placement) => placement.team === team.key && !placement.role)}
					<ul role="list" class="mt-2 flex flex-wrap gap-1.5">
						{#each placements.filter((placement) => placement.team === team.key && !placement.role) as placement (placement.key)}
							{@const player = playerAt(placement.key)}
							<li>
								<button
									type="button"
									class="bench-chip"
									data-player-id={player?.playerId}
									data-lineup-key={placement.key}
									data-filled={player !== null}
									data-you={player !== null && isViewer(player.playerId)}
									data-selected={selected === placement.key}
										data-drag-source={drag?.dragging && drag.key === placement.key}
									data-drop-active={hoverKey === placement.key}
									data-awaiting={canEdit &&
										selected !== null &&
										selected !== placement.key &&
										canTarget(placement.key)}
									data-ineligible={canEdit && selected !== null && !canTarget(placement.key)}
									disabled={(!canEdit && player === null) ||
										(canEdit &&
											selected !== null &&
											!canTarget(placement.key) &&
											player === null)}
									data-player-peek={!canEdit && player ? 'click' : undefined}
									onclick={(event) => handleClick(event, placement.key)}
									aria-label={player ? ariaWithYou(slotAriaLabel(team.key, placement, player), player) : slotAriaLabel(team.key, placement, null)}
									aria-haspopup={!canEdit && player ? 'dialog' : undefined}
									aria-expanded={!canEdit && player ? 'false' : undefined}
									aria-pressed={canEdit && player ? selected === placement.key : undefined}
								>
									{#if player}
										<span class="bench-portrait">
											<Avatar player={portrait(player)} fill />
										</span>
										<span class="font-mono text-caption text-muted"
											>{player.jerseyNumber ?? '?'}</span
										>
										<span class="bench-name">{player.fullName}</span>
										{#if isViewer(player.playerId)}
											<span class="stamp border-ice bg-ice-soft text-ice-deep"
												>{t('common.you')}</span
											>
										{/if}
									{:else}
										<span class="bench-empty-mark" aria-hidden="true">+</span>
										<span class="text-muted">{t('rink.emptySlot')}</span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				{#if activeTeam === team.key}
					<div class="rink-roster mt-3">
						<p class="micro-label px-3">{t('rink.roster')}</p>
						<TeamRoster
							slots={rosterSlots}
							team={team.key}
							{actorId}
							{ownTeam}
							heading={false}
							peek={!canEdit}
						/>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if canEdit || benchPlayers.length > 0}
		<div
			class="bench-zone"
			data-editable={canEdit}
			data-bench-drop={canEdit ? 'true' : undefined}
			data-drop-active={benchHover}
		>
			<h3 class="text-subhead font-semibold">{t('rink.bench')}</h3>
			{#if benchPlayers.length > 0}
				<ul role="list" class="mt-2 flex flex-wrap gap-1.5">
					{#each benchPlayers as player (player.playerId)}
						<li>
							<button
								type="button"
								class="bench-chip"
								data-player-id={player.playerId}
								data-lineup-key={benchKey(player.playerId)}
								data-filled="true"
								data-you={isViewer(player.playerId)}
								data-selected={selected === benchKey(player.playerId)}
								data-drag-source={drag?.dragging && drag.key === benchKey(player.playerId)}
								data-drop-active={hoverKey === benchKey(player.playerId)}
								data-player-peek={!canEdit ? 'click' : undefined}
								onclick={(event) => handleClick(event, benchKey(player.playerId))}
								aria-label={ariaWithYou(`${player.jerseyNumber ?? '?'} ${player.fullName}`, player)}
								aria-haspopup={!canEdit ? 'dialog' : undefined}
								aria-expanded={!canEdit ? 'false' : undefined}
								aria-pressed={canEdit ? selected === benchKey(player.playerId) : undefined}
							>
								<span class="bench-portrait">
									<Avatar player={portrait(player)} fill />
								</span>
								<span class="font-mono text-caption text-muted">{player.jerseyNumber ?? '?'}</span>
								<span class="bench-name">{player.fullName}</span>
								{#if isViewer(player.playerId)}
									<span class="stamp border-ice bg-ice-soft text-ice-deep">{t('common.you')}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mt-2 text-meta text-muted">{t('rink.benchEmpty')}</p>
			{/if}
		</div>
	{/if}

	{#if canEdit && selected && selectedPlayer}
		<div class="selection-tray">
			<span class="selection-portrait">
				<Avatar player={portrait(selectedPlayer)} fill />
			</span>
			<div class="min-w-0" role="status">
				<p class="truncate text-body font-semibold">{selectedPlayer.fullName}</p>
				<p class="text-meta text-muted">
					{selectedIsBench ? t('rink.selectedBench') : t('rink.selectedIce')}
				</p>
				<p class="hint mt-0.5">
					{t('rink.positionOnly', {
						position: t(positionDefinition(selectedPlayer.position).labelKey)
					})}
				</p>
			</div>
			<div class="ml-auto flex flex-wrap items-center gap-2">
				{#if !selectedIsBench}
					<button class="btn-ghost btn-sm" type="button" onclick={removeSelected}>
						{t('rink.remove')}
					</button>
				{/if}
				<button class="btn-ghost btn-sm" type="button" onclick={() => (selected = null)}>
					{t('common.cancel')}
				</button>
			</div>
		</div>
	{/if}

	{#if canEdit}
		<form
			method="POST"
			action="?/lineup"
			use:progressiveForm={{ restoreFocus: false }}
			class="lineup-actions flex flex-wrap items-center gap-2"
		>
			<input type="hidden" name="lineup" value={assignmentsJson} />
			<input
				type="hidden"
				name="expectedGeneratedAt"
				value={expectedGeneratedAt === null ? '' : String(expectedGeneratedAt)}
			/>
			<button class="btn-primary" type="submit" disabled={!dirty}>{t('rink.save')}</button>
			<button
				class="btn-ghost btn-sm"
				type="button"
				disabled={history.length === 0}
				onclick={undo}
			>
				{t('rink.undo')}
			</button>
			{#if dirty}
				<button class="btn-ghost btn-sm" type="button" onclick={reset}>
					{t('rink.reset')}
				</button>
			{/if}
		</form>
	{/if}

	{#if drag?.dragging && draggedPlayer}
		<div
			class="drag-ghost"
			style="left: {drag.x}px; top: {drag.y}px"
			aria-hidden="true"
		>
			<span class="drag-ghost-portrait">
				<Avatar player={portrait(draggedPlayer)} fill />
			</span>
			<span class="drag-ghost-name">{draggedPlayer.fullName}</span>
		</div>
	{/if}
</section>
