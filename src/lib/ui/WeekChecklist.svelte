<script lang="ts">
	import type { AvailabilityView } from '#lib/domain/availability/service.ts';
	import type { ChatMessageView } from '#lib/domain/chat/service.ts';
	import type { BalanceView } from '#lib/domain/finance/service.ts';
	import { formatCount, formatMoney, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	type StepState = 'done' | 'todo' | 'idle';

	let {
		gameId,
		availability,
		generated,
		line,
		balance,
		openCount,
		ownRequest,
		showSubs,
		chat
	}: {
		gameId: string;
		availability: AvailabilityView | null;
		generated: boolean;
		line?: string | null;
		balance: BalanceView | null;
		openCount: number;
		ownRequest: boolean;
		showSubs: boolean;
		chat: ChatMessageView[];
	} = $props();

	const latest = $derived(chat[0] ?? null);

	type Step = {
		id: string;
		title: string;
		state: StepState;
		detail?: string;
		label?: string;
		action?: { href: string; label: string };
	};

	const steps = $derived.by<Step[]>(() => {
		const list: Step[] = [];

		if (availability?.locked) {
			list.push({
				id: 'presence',
				title: t('home.steps.answer'),
				state: availability.canWithdraw ? 'done' : 'idle',
				detail: availability.canWithdraw
					? t('availability.lockedHelp')
					: t('availability.locked')
			});
		} else if (availability?.canRespond) {
			const answered = availability.own === 'present' || availability.own === 'absent';
			list.push({
				id: 'presence',
				title: t('home.steps.answer'),
				state: answered ? 'done' : 'todo',
				detail: answered
					? availability.own === 'present'
						? t('home.replyPresent')
						: t('home.replyAbsent')
					: t('home.steps.answerTodo', { date: availability.closesAtLabel })
			});
		} else {
			list.push({
				id: 'presence',
				title: t('home.steps.answer'),
				state: 'idle',
				detail: availability?.summary ?? t('availability.gameClosed')
			});
		}

		list.push({
			id: 'team',
			title: t('home.steps.team'),
			state: line ? 'done' : 'idle',
			label: !line && generated ? t('home.steps.noPlace') : undefined,
			detail: line ?? (generated ? t('home.steps.notInLineup') : t('home.steps.teamWaiting')),
			action: { href: `/matchs/${gameId}`, label: t('home.steps.viewLineup') }
		});

		if (showSubs) {
			list.push({
				id: 'place',
				title: t('home.steps.place'),
				state: ownRequest ? 'done' : openCount > 0 ? 'todo' : 'idle',
				detail: ownRequest
					? t('subs.ownRequestOpen')
					: openCount > 0
						? formatCount(
								openCount,
								'home.steps.placeOpen.one',
								'home.steps.placeOpen.many'
							)
						: t('home.steps.placeNone'),
				action: { href: '/remplacants', label: t('home.substituteCta') }
			});
		}

		list.push({
			id: 'balance',
			title: t('home.balance'),
			state: !balance ? 'idle' : balance.outstandingCents === 0 ? 'done' : 'todo',
			detail: !balance
				? t('home.steps.noBalance')
				: balance.outstandingCents === 0
					? t('home.steps.balanceClear')
					: balance.isOverdue
						? t('home.steps.balanceLate', {
								amount: formatMoney(balance.outstandingCents, balance.currency)
							})
						: t('home.steps.balanceOpen', {
								amount: formatMoney(balance.outstandingCents, balance.currency)
							}),
			action: { href: '/solde', label: t('home.steps.viewBalance') }
		});

		list.push({
			id: 'discussion',
			title: t('home.steps.discussion'),
			state: 'idle',
			label: t('home.steps.info'),
			detail: latest
				? latest.deleted
					? t('chat.deleted')
					: latest.kind === 'poll'
						? (latest.poll?.question ?? t('chat.pollTag'))
						: (latest.body ?? '')
				: t('chat.empty'),
			action: { href: '/discussion', label: t('home.steps.openChat') }
		});

		return list;
	});

	function stateLabel(state: StepState): string {
		return state === 'done'
			? t('home.steps.done')
			: state === 'todo'
				? t('home.steps.todo')
				: t('home.steps.waiting');
	}

	function stateClass(state: StepState): string {
		return state === 'done'
			? 'border-ok/40 bg-ok-soft text-ok'
			: state === 'todo'
				? 'border-ochre bg-ochre/10 text-ink'
				: 'border-line text-muted';
	}

	const doneCount = $derived(steps.filter((step) => step.state === 'done').length);

	function isSelected(status: 'present' | 'absent'): boolean {
		return availability?.own === status;
	}
</script>

<section class="sheet" aria-labelledby="semaine-titre">
	<header class="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
		<h2 id="semaine-titre">{t('home.steps.title')}</h2>
		<span class="serial">{doneCount} / {steps.length}</span>
	</header>
	<ol role="list" class="divide-y divide-line">
		{#each steps as step (step.id)}
			<!-- cible du lien « Répondre » : on veut y déplacer le focus, pas en faire un contrôle -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<li
				class="flex scroll-mt-[var(--anchor-offset)] gap-3 px-4 py-2.5"
				id={step.id === 'presence' ? 'presence' : undefined}
				tabindex={step.id === 'presence' ? -1 : undefined}
			>
				<span class="stamp mt-0.5 h-fit w-[4.5rem] shrink-0 justify-center {stateClass(step.state)}">
					{step.label ?? stateLabel(step.state)}
				</span>

				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
						<p class="min-w-0 text-sm font-semibold leading-5">{step.title}</p>
						{#if step.action && step.id !== 'presence'}
							<a
								class="link -my-2 inline-flex min-h-11 items-center text-xs"
								href={step.action.href}
							>
								{step.action.label}
							</a>
						{/if}
					</div>
					<p
						class="mt-0.5 break-words text-xs leading-snug {step.id === 'balance' && balance?.isOverdue
							? 'font-medium text-alert'
							: 'text-muted'}"
					>
						{step.detail}
					</p>

					{#if step.id === 'presence' && availability?.canWithdraw}
						<form method="POST" action="?/availability" use:progressiveForm class="mt-2">
							<input type="hidden" name="gameId" value={gameId} />
							<input type="hidden" name="status" value="absent" />
							<ConfirmSubmit
								label={t('availability.withdraw')}
								question={t('availability.withdrawConfirm')}
								confirmLabel={t('availability.withdraw')}
								class="btn-secondary btn-sm w-full"
							/>
						</form>
					{/if}

					{#if step.id === 'presence' && availability?.canRespond}
						<form
							method="POST"
							action="?/availability"
							use:progressiveForm
							class="mt-2 grid grid-cols-2 gap-2"
						>
							<input type="hidden" name="gameId" value={gameId} />
							<button
								class="min-h-11 border px-1.5 text-xs font-semibold transition-colors {isSelected(
									'present'
								)
									? 'border-ink bg-ink text-paper'
									: 'border-line-strong bg-surface text-ink hover:border-ink'}"
								name="status"
								value="present"
								type="submit"
								aria-pressed={isSelected('present')}
							>
								{t('availability.markPresent')}
							</button>
							<button
								class="min-h-11 border px-1.5 text-xs font-semibold transition-colors {isSelected(
									'absent'
								)
									? 'border-ink bg-ink text-paper'
									: 'border-line-strong bg-surface text-ink hover:border-ink'}"
								name="status"
								value="absent"
								type="submit"
								aria-pressed={isSelected('absent')}
							>
								{t('availability.markAbsent')}
							</button>
						</form>
					{/if}

					{#if step.id === 'discussion' && latest}
						<p class="mt-1 text-[11px] text-muted">
							{latest.authorName} · {formatTimestamp(latest.createdAt)}
						</p>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
</section>
