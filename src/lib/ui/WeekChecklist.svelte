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
			state: latest ? 'done' : 'idle',
			detail: latest
				? latest.deleted
					? t('chat.deleted')
					: latest.kind === 'poll'
						? (latest.poll?.question ?? t('chat.pollTag'))
						: (latest.body ?? '')
				: t('home.steps.chatEmpty'),
			action: { href: '/discussion', label: t('home.steps.openChat') }
		});

		return list;
	});

	const firstOpen = $derived(steps.findIndex((step) => step.state !== 'done'));
	const filledTo = $derived(firstOpen === -1 ? steps.length : firstOpen);

	function isSelected(status: 'present' | 'absent'): boolean {
		return availability?.own === status;
	}
</script>

<section class="card" aria-labelledby="semaine-titre">
	<div class="flex items-baseline justify-between gap-3">
		<h2 id="semaine-titre">{t('home.steps.title')}</h2>
	</div>
	<ol role="list" class="mt-4">
		{#each steps as step, index (step.id)}
			<!-- cible du lien « Répondre » : on veut y déplacer le focus, pas en faire un contrôle -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<li
				class="relative scroll-mt-[var(--anchor-offset)] pb-4 pl-9 last:pb-0"
				id={step.id === 'presence' ? 'presence' : undefined}
				tabindex={step.id === 'presence' ? -1 : undefined}
			>
				{#if index < steps.length - 1}
					<span
						aria-hidden="true"
						class="absolute left-[9px] top-5 h-[calc(100%-0.75rem)] w-px {index < filledTo
							? 'bg-ice'
							: 'bg-line'}"
					></span>
				{/if}

				<span
					aria-hidden="true"
					class="absolute left-0 top-0 grid h-5 w-5 place-items-center rounded-full border text-[11px] font-bold {step.state ===
					'done'
						? 'border-ink bg-ink text-paper'
						: step.state === 'todo'
							? 'border-ice bg-ice text-paper'
							: 'border-line-strong bg-surface text-muted'}"
				>
					{index + 1}
				</span>

				<div class="flex items-baseline justify-between gap-3">
					<p class="text-sm font-semibold leading-6">{step.title}</p>
					{#if step.action && step.id !== 'presence'}
						<a class="link -my-2 inline-flex min-h-11 shrink-0 items-center text-sm" href={step.action.href}>
							{step.action.label}
						</a>
					{/if}
				</div>
				<p
					class="mt-0.5 break-words text-sm leading-snug {step.id === 'balance' && balance?.isOverdue
						? 'font-medium text-alert'
						: 'text-muted'}"
				>
					{step.detail}
				</p>

				{#if step.id === 'presence' && availability?.canWithdraw}
					<form method="POST" action="?/availability" use:progressiveForm class="mt-3">
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
						class="mt-3 grid grid-cols-2 gap-2"
					>
						<input type="hidden" name="gameId" value={gameId} />
						<button
							class="min-h-11 whitespace-nowrap rounded-control border px-1.5 text-[13px] font-semibold transition-colors {isSelected(
								'present'
							)
								? 'border-ice bg-ice text-on-brand'
								: 'border-line-strong bg-surface text-ink hover:bg-paper'}"
							name="status"
							value="present"
							type="submit"
							aria-pressed={isSelected('present')}
						>
							{t('availability.markPresent')}
						</button>
						<button
							class="min-h-11 whitespace-nowrap rounded-control border px-1.5 text-[13px] font-semibold transition-colors {isSelected(
								'absent'
							)
								? 'border-ink bg-ink text-paper'
								: 'border-line-strong bg-surface text-ink hover:bg-paper'}"
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
					<p class="mt-1 text-xs text-muted">
						{latest.authorName} · {formatTimestamp(latest.createdAt)}
					</p>
				{/if}
			</li>
		{/each}
	</ol>
</section>
