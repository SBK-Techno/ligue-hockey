<script lang="ts">
	import { GOAL_KINDS, goalKindDefinition } from '#config/goal-kinds.ts';
	import { INFRACTIONS, PENALTY_MINUTES, infractionDefinition } from '#config/infractions.ts';
	import { PERIOD_NUMBERS } from '#config/periods.ts';
	import { TEAMS, teamDefinition, type Team } from '#config/teams.ts';
	import type { GameSlotView } from '#lib/domain/games/types.ts';
	import type { GameSheetView } from '#lib/domain/gamesheet/service.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	let {
		sheet,
		slots,
		canManage,
		completed
	}: {
		sheet: GameSheetView;
		slots: readonly GameSlotView[];
		canManage: boolean;
		completed: boolean;
	} = $props();

	type Dressed = { playerId: string; fullName: string; jerseyNumber: number | null };

	const dressed = $derived.by<Record<Team, Dressed[]>>(() => {
		const byTeam: Record<Team, Dressed[]> = { white: [], black: [] };
		for (const slot of slots) {
			if (!slot.player) continue;
			if (byTeam[slot.team].some((entry) => entry.playerId === slot.player?.playerId)) continue;
			byTeam[slot.team].push({
				playerId: slot.player.playerId,
				fullName: slot.player.fullName,
				jerseyNumber: slot.player.jerseyNumber
			});
		}
		for (const team of TEAMS) {
			byTeam[team.key].sort(
				(a, b) =>
					(a.jerseyNumber ?? Number.MAX_SAFE_INTEGER) -
						(b.jerseyNumber ?? Number.MAX_SAFE_INTEGER) ||
					a.fullName.localeCompare(b.fullName)
			);
		}
		return byTeam;
	});

	let goalTeam = $state<Team>('white');
	let goalScorer = $state('');
	let penaltyTeam = $state<Team>('white');

	const goalAssists = $derived(
		dressed[goalTeam].filter((player) => player.playerId !== goalScorer)
	);

	function periodsOf<T extends { period: number }>(
		rows: readonly T[]
	): { period: number; rows: T[] }[] {
		const grouped: { period: number; rows: T[] }[] = [];
		for (const row of rows) {
			const bucket = grouped.find((entry) => entry.period === row.period);
			if (bucket) bucket.rows.push(row);
			else grouped.push({ period: row.period, rows: [row] });
		}
		return grouped.sort((a, b) => a.period - b.period);
	}

	const goalPeriods = $derived(periodsOf(sheet.goals));
	const penaltyPeriods = $derived(periodsOf(sheet.penalties));

	function number(value: number | null): string {
		return value === null ? '' : `#${value}`;
	}
</script>

<div class="space-y-5">
	<div class="rounded-card border border-line bg-ink px-4 py-3 text-paper">
		<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
			{#each TEAMS as team, index (team.key)}
				{#if index === 1}
					<span class="mx-auto h-8 w-px bg-paper/25" aria-hidden="true"></span>
				{/if}
				<div class={index === 0 ? 'text-right' : 'text-left'}>
					<p class="text-caption text-paper/70">{t(teamDefinition(team.key).shortLabelKey)}</p>
					<p class="font-mono text-figure font-semibold tabular-nums">{sheet.score[team.key]}</p>
				</div>
			{/each}
		</div>
		{#if completed}
			<p class="mt-1 text-center text-caption text-paper/60">{t('gamesheet.finalized')}</p>
		{/if}
	</div>

	<section>
		<h3 class="text-subhead font-semibold">{t('gamesheet.goals')}</h3>
		{#if sheet.goals.length === 0}
			<p class="mt-2 text-body text-muted">{t('gamesheet.noGoals')}</p>
		{:else}
			{#each goalPeriods as group (group.period)}
				<p class="mt-4 text-caption font-semibold text-muted">
					{t('gamesheet.period')} {group.period}
				</p>
				<ul role="list" class="mt-1 divide-y divide-line border-y border-line">
					{#each group.rows as goal (goal.id)}
						<li class="flex items-start gap-2.5 py-2">
							<span class="w-11 shrink-0 pt-0.5 font-mono text-meta tabular-nums text-muted">
								{goal.clock}
							</span>
							<span
								class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full {goal.team === 'black'
									? 'bg-team-black'
									: 'border border-line-strong bg-team-white'}"
								aria-hidden="true"
							></span>
							<div class="min-w-0 flex-1">
								<p class="text-body font-semibold">
									{#if goal.scorer}
										<span class="font-mono text-meta text-muted"
											>{number(goal.scorer.jerseyNumber)}</span
										>
										{goal.scorer.fullName}
									{:else}
										{t('gamesheet.noGoals')}
									{/if}
								</p>
								{#if goal.assists.length > 0}
									<p class="text-meta text-muted">
										{t('gamesheet.assists')}:
										{goal.assists
											.map((assist) => `${number(assist.jerseyNumber)} ${assist.fullName}`)
											.join(' · ')}
									</p>
								{/if}
							</div>
							{#if goal.kind !== 'even'}
								<span class="badge shrink-0">{t(goalKindDefinition(goal.kind).labelKey)}</span>
							{/if}
							{#if canManage}
								<details class="action-menu shrink-0">
									<summary aria-label={t('gamesheet.deleteGoal')}>
										<svg viewBox="0 0 20 20" class="h-5 w-5" aria-hidden="true">
											<circle cx="4" cy="10" r="1.5" fill="currentColor" />
											<circle cx="10" cy="10" r="1.5" fill="currentColor" />
											<circle cx="16" cy="10" r="1.5" fill="currentColor" />
										</svg>
									</summary>
									<div class="action-menu-panel">
										<form method="POST" action="?/deleteGoal" use:progressiveForm>
											<input type="hidden" name="goalId" value={goal.id} />
											<ConfirmSubmit
												label={t('gamesheet.deleteGoal')}
												question={t('gamesheet.deleteGoalConfirm')}
												class="btn-ghost btn-sm"
											/>
										</form>
									</div>
								</details>
							{/if}
						</li>
					{/each}
				</ul>
			{/each}
		{/if}
	</section>

	<section>
		<h3 class="text-subhead font-semibold">{t('gamesheet.penalties')}</h3>
		{#if sheet.penalties.length === 0}
			<p class="mt-2 text-body text-muted">{t('gamesheet.noPenalties')}</p>
		{:else}
			{#each penaltyPeriods as group (group.period)}
				<p class="mt-4 text-caption font-semibold text-muted">
					{t('gamesheet.period')} {group.period}
				</p>
				<ul role="list" class="mt-1 divide-y divide-line border-y border-line">
					{#each group.rows as penalty (penalty.id)}
						<li class="flex items-start gap-2.5 py-2">
							<span class="w-11 shrink-0 pt-0.5 font-mono text-meta tabular-nums text-muted">
								{penalty.clock}
							</span>
							<span
								class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full {penalty.team === 'black'
									? 'bg-team-black'
									: 'border border-line-strong bg-team-white'}"
								aria-hidden="true"
							></span>
							<div class="min-w-0 flex-1">
								<p class="text-body font-semibold">
									<span class="font-mono text-meta text-muted"
										>{number(penalty.player.jerseyNumber)}</span
									>
									{penalty.player.fullName}
								</p>
								<p class="text-meta text-muted">
									{t(infractionDefinition(penalty.infraction).labelKey)} · {penalty.minutes}
									{t('gamesheet.minutes')}
									{#if penalty.coincidental}· {t('gamesheet.coincidental')}{/if}
								</p>
							</div>
							{#if canManage}
								<details class="action-menu shrink-0">
									<summary aria-label={t('gamesheet.deletePenalty')}>
										<svg viewBox="0 0 20 20" class="h-5 w-5" aria-hidden="true">
											<circle cx="4" cy="10" r="1.5" fill="currentColor" />
											<circle cx="10" cy="10" r="1.5" fill="currentColor" />
											<circle cx="16" cy="10" r="1.5" fill="currentColor" />
										</svg>
									</summary>
									<div class="action-menu-panel">
										<form method="POST" action="?/deletePenalty" use:progressiveForm>
											<input type="hidden" name="penaltyId" value={penalty.id} />
											<ConfirmSubmit
												label={t('gamesheet.deletePenalty')}
												question={t('gamesheet.deletePenaltyConfirm')}
												class="btn-ghost btn-sm"
											/>
										</form>
									</div>
								</details>
							{/if}
						</li>
					{/each}
				</ul>
			{/each}
		{/if}
	</section>

	<section>
		<h3 class="text-subhead font-semibold">{t('gamesheet.totals')}</h3>
		<table class="mt-2 w-full text-meta">
			<thead>
				<tr class="border-b border-line text-left text-caption text-muted">
					<th class="w-8 py-1 font-semibold">{t('gamesheet.jerseyShort')}</th>
					<th class="py-1 font-semibold">{t('gamesheet.player')}</th>
					<th class="w-7 py-1 text-right font-semibold">{t('gamesheet.goalsShort')}</th>
					<th class="w-7 py-1 text-right font-semibold">{t('gamesheet.assistsShort')}</th>
					<th class="w-7 py-1 text-right font-semibold">{t('gamesheet.pointsShort')}</th>
					<th class="w-9 py-1 text-right font-semibold">{t('gamesheet.penaltyMinutesShort')}</th>
				</tr>
			</thead>
			{#each TEAMS as team (team.key)}
				<tbody>
					<tr>
						<th
							colspan="6"
							class="pt-3 pb-1 text-left text-caption font-semibold text-muted"
						>
							{t(teamDefinition(team.key).labelKey)}
						</th>
					</tr>
					{#each sheet.totals.filter((row) => row.team === team.key) as row (row.playerId)}
						<tr class="border-b border-line last:border-b-0">
							<td class="py-1.5 font-mono text-muted">{row.jerseyNumber ?? ''}</td>
							<td class="py-1.5 pr-2 font-medium">{row.fullName}</td>
							<td class="py-1.5 text-right font-mono tabular-nums">{row.goals}</td>
							<td class="py-1.5 text-right font-mono tabular-nums">{row.assists}</td>
							<td class="py-1.5 text-right font-mono font-semibold tabular-nums">{row.points}</td>
							<td class="py-1.5 text-right font-mono tabular-nums">{row.penaltyMinutes}</td>
						</tr>
					{/each}
				</tbody>
			{/each}
		</table>
	</section>

	{#if canManage}
		<div class="grid gap-3 lg:grid-cols-2">
			<details class="sheet p-0">
				<summary class="min-h-11 cursor-pointer px-4 py-3 text-body font-semibold">
					{t('gamesheet.addGoal')}
				</summary>
				<form method="POST" action="?/goal" use:progressiveForm class="space-y-3 border-t border-line p-4">
					<div>
						<label class="label" for="goal-team">{t('home.team')}</label>
						<select class="input" id="goal-team" name="team" bind:value={goalTeam}>
							{#each TEAMS as team (team.key)}
								<option value={team.key}>{t(teamDefinition(team.key).labelKey)}</option>
							{/each}
						</select>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="label" for="goal-period">{t('gamesheet.period')}</label>
							<select class="input" id="goal-period" name="period">
								{#each PERIOD_NUMBERS as period (period)}
									<option value={period}>{period}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="label" for="goal-clock">{t('gamesheet.clock')}</label>
							<input
								class="input"
								id="goal-clock"
								name="clock"
								placeholder="12:34"
								inputmode="numeric"
								required
							/>
						</div>
					</div>
					<div>
						<label class="label" for="goal-scorer">{t('gamesheet.scorer')}</label>
						<select
							class="input"
							id="goal-scorer"
							name="scorerPlayerId"
							required
							bind:value={goalScorer}
						>
							<option value="">{t('gamesheet.selectPlayer')}</option>
							{#each dressed[goalTeam] as player (player.playerId)}
								<option value={player.playerId}>
									{number(player.jerseyNumber)} {player.fullName}
								</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label" for="goal-assist-1">{t('gamesheet.optionalAssist')} 1</label>
						<select class="input" id="goal-assist-1" name="assist1PlayerId">
							<option value="">{t('common.none')}</option>
							{#each goalAssists as player (player.playerId)}
								<option value={player.playerId}>
									{number(player.jerseyNumber)} {player.fullName}
								</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label" for="goal-assist-2">{t('gamesheet.optionalAssist')} 2</label>
						<select class="input" id="goal-assist-2" name="assist2PlayerId">
							<option value="">{t('common.none')}</option>
							{#each goalAssists as player (player.playerId)}
								<option value={player.playerId}>
									{number(player.jerseyNumber)} {player.fullName}
								</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label" for="goal-kind">{t('gamesheet.goalType')}</label>
						<select class="input" id="goal-kind" name="kind">
							{#each GOAL_KINDS as kind (kind.key)}
								<option value={kind.key}>{t(kind.labelKey)}</option>
							{/each}
						</select>
					</div>
					<button class="btn-primary btn-sm" type="submit">{t('gamesheet.saveGoal')}</button>
				</form>
			</details>

			<details class="sheet p-0">
				<summary class="min-h-11 cursor-pointer px-4 py-3 text-body font-semibold">
					{t('gamesheet.addPenalty')}
				</summary>
				<form
					method="POST"
					action="?/penalty"
					use:progressiveForm
					class="space-y-3 border-t border-line p-4"
				>
					<div>
						<label class="label" for="penalty-team">{t('home.team')}</label>
						<select class="input" id="penalty-team" name="team" bind:value={penaltyTeam}>
							{#each TEAMS as team (team.key)}
								<option value={team.key}>{t(teamDefinition(team.key).labelKey)}</option>
							{/each}
						</select>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="label" for="penalty-period">{t('gamesheet.period')}</label>
							<select class="input" id="penalty-period" name="period">
								{#each PERIOD_NUMBERS as period (period)}
									<option value={period}>{period}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="label" for="penalty-clock">{t('gamesheet.clock')}</label>
							<input
								class="input"
								id="penalty-clock"
								name="clock"
								placeholder="12:34"
								inputmode="numeric"
								required
							/>
						</div>
					</div>
					<div>
						<label class="label" for="penalty-player">{t('gamesheet.player')}</label>
						<select class="input" id="penalty-player" name="playerId" required>
							<option value="">{t('gamesheet.selectPlayer')}</option>
							{#each dressed[penaltyTeam] as player (player.playerId)}
								<option value={player.playerId}>
									{number(player.jerseyNumber)} {player.fullName}
								</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label" for="penalty-infraction">{t('gamesheet.infraction')}</label>
						<select class="input" id="penalty-infraction" name="infraction">
							{#each INFRACTIONS as infraction (infraction.key)}
								<option value={infraction.key}>{t(infraction.labelKey)}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label" for="penalty-minutes">{t('gamesheet.minutes')}</label>
						<select class="input" id="penalty-minutes" name="minutes">
							{#each PENALTY_MINUTES as minutes (minutes)}
								<option value={minutes}>{minutes}</option>
							{/each}
						</select>
					</div>
					<label class="flex min-h-11 items-center gap-2 text-body">
						<input type="checkbox" name="coincidental" class="h-5 w-5" />
						{t('gamesheet.coincidental')}
					</label>
					<button class="btn-primary btn-sm" type="submit">{t('gamesheet.savePenalty')}</button>
				</form>
			</details>
		</div>

		{#if !completed}
			<form method="POST" action="?/finalize" use:progressiveForm>
				<ConfirmSubmit
					label={t('gamesheet.finalize')}
					question={t('gamesheet.finalizeConfirm')}
					confirmLabel={t('gamesheet.finalize')}
					class="btn-secondary"
				/>
			</form>
		{/if}
	{/if}
</div>
