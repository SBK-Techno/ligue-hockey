<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import { ACCOUNT_LIMITS } from '#config/account.ts';
	import { positionDefinition, type Position } from '#config/positions.ts';
	import {
		formatCount,
		formatDecimal,
		formatMonthYear,
		formatMoney,
		formatTimestamp,
		t
	} from '#lib/shared/i18n/index.ts';
	import Avatar from '#lib/ui/Avatar.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import { fieldErrorFor } from '#lib/ui/form-feedback.ts';
	import { monogram } from '#lib/ui/identity-display.ts';
	import { pushPreferenceState } from './push-preference.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const account = $derived(data.account);
	const profile = $derived(data.profile);
	const legend = $derived(data.legend);

	// Comme sur l'accueil, chaque îlot est importé au niveau du module : le
	// serveur le rend, le navigateur ne le demande qu'après la peinture.
	// svelte-ignore state_referenced_locally
	const initial = data;
	const hasOtherSessions = initial.sessions.some(
		(session) => session.id !== initial.currentSessionId
	);
	const [
		IdentityDisclosure,
		PositionChips,
		StatStrip,
		PasswordField,
		ConfirmSubmit,
		InstallPrompt
	] = await Promise.all([
		initial.avatarPicker
			? import('#lib/ui/IdentityDisclosure.svelte').then((module) => module.default)
			: null,
		initial.isSubstitute
			? import('#lib/ui/PositionChips.svelte').then((module) => module.default)
			: null,
		initial.stats && initial.stats.games > 0
			? import('#lib/ui/StatStrip.svelte').then((module) => module.default)
			: null,
		import('#lib/ui/PasswordField.svelte').then((module) => module.default),
		hasOtherSessions
			? import('#lib/ui/ConfirmSubmit.svelte').then((module) => module.default)
			: null,
		import('#lib/ui/InstallPrompt.svelte').then((module) => module.default)
	]);
	// Le poste suit le formulaire : la liste de légendes se filtre tout de suite.
	// svelte-ignore state_referenced_locally
	let position = $state<Position | null>(profile?.position ?? null);
	const isManager = $derived(data.nav.canViewAdmin);
	const canSeeRatings = $derived(data.nav.canSeeRatings);
	const managementLinks = $derived(data.nav.managementLinks);
	const roleLabel = $derived(account ? t(data.nav.roleLabelKey) : '');
	const initials = $derived(account ? monogram(account.name) : '');
	const otherSessions = $derived(
		data.sessions.filter((session) => session.id !== data.currentSessionId)
	);
	const currentSession = $derived(
		data.sessions.find((session) => session.id === data.currentSessionId)
	);
	const currentHash = $derived(page.url.hash);

	let pushStatus = $state<
		'checking' | 'off' | 'on' | 'denied' | 'unsupported' | 'unconfigured'
	>('checking');
	let pushError = $state<string | null>(null);
	const pushPreference = $derived(
		pushPreferenceState(pushStatus, data.notifications.pushEnabled)
	);


	function deviceLabel(userAgent: string | null): string {
		if (!userAgent) return t('profile.unknownDevice');
		const ua = userAgent.toLowerCase();
		const browserName = ua.includes('edg/')
			? 'Edge'
			: ua.includes('firefox/')
				? 'Firefox'
				: ua.includes('chrome/')
					? 'Chrome'
					: ua.includes('safari/')
						? 'Safari'
						: '';
		const system = /iphone|ipad|ipod/.test(ua)
			? 'iOS'
			: ua.includes('android')
				? 'Android'
				: ua.includes('mac os x')
					? 'macOS'
					: ua.includes('windows')
						? 'Windows'
						: ua.includes('linux')
							? 'Linux'
							: '';
		return [browserName, system].filter(Boolean).join(' · ') || t('profile.unknownDevice');
	}

	function urlBase64ToUint8Array(base64String: string): Uint8Array {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(base64);
		const output = new Uint8Array(raw.length);
		for (let index = 0; index < raw.length; index += 1) {
			output[index] = raw.charCodeAt(index);
		}
		return output;
	}

	onMount(async () => {
		if (!browser || !('serviceWorker' in navigator) || !('PushManager' in window)) {
			pushStatus = 'unsupported';
			return;
		}
		if (!data.vapidPublicKey) {
			pushStatus = 'unconfigured';
			return;
		}
		if (Notification.permission === 'denied') {
			pushStatus = 'denied';
			return;
		}
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		pushStatus = subscription ? 'on' : 'off';
	});

	async function enablePush() {
		pushError = null;
		try {
			if (Notification.permission === 'denied') {
				pushStatus = 'denied';
				return;
			}
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				pushStatus = 'denied';
				return;
			}
			const registration = await navigator.serviceWorker.ready;
			const key = data.vapidPublicKey;
			if (!key) return;
			const subscription =
				(await registration.pushManager.getSubscription()) ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(key) as BufferSource
				}));
			const response = await fetch('/api/push/abonnement', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(subscription.toJSON())
			});
			if (!response.ok) throw new Error('subscribe failed');
			pushStatus = 'on';
		} catch {
			pushError = t('profile.pushFailed');
		}
	}

	async function disablePush() {
		pushError = null;
		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();
			if (subscription) {
				await fetch('/api/push/abonnement', {
					method: 'DELETE',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: subscription.endpoint })
				});
				await subscription.unsubscribe();
			}
			pushStatus = 'off';
		} catch {
			pushError = t('error.generic');
		}
	}

	const isIos = $derived(
		browser &&
			/iphone|ipad|ipod/i.test(navigator.userAgent) &&
			!window.matchMedia('(display-mode: standalone)').matches
	);

	const passwordError = $derived(fieldErrorFor(form, 'securite', 'currentPassword'));

	$effect(() => {
		const field = (form as { field?: string } | null)?.field;
		if (!form || form.ok !== false || form.section !== 'securite' || !field) return;
		const control = document.getElementById(field);
		const group = control?.closest('details');
		if (group instanceof HTMLDetailsElement) group.open = true;
		void tick().then(() => control?.focus());
	});

	const statsCells = $derived(
		data.stats
			? [
					{ label: t('stats.games'), value: data.stats.games },
					{ label: t('stats.goals'), value: data.stats.goals },
					{ label: t('stats.assists'), value: data.stats.assists },
					{ label: t('stats.points'), value: data.stats.points },
					{ label: t('stats.penalties'), value: data.stats.penalties }
				]
			: []
	);

	const sections = $derived([
		{ id: 'compte', label: t('profile.tab.account') },
		...(profile ? [{ id: 'joueur', label: t('profile.tab.player') }] : []),
		...(data.stats ? [{ id: 'stats', label: t('profile.tab.stats') }] : []),
		{ id: 'notifications', label: t('profile.tab.notifications') },
		{ id: 'securite', label: t('profile.tab.security') },
		...(isManager ? [{ id: 'administration', label: t('profile.tab.admin') }] : [])
	]);
</script>

<PageHeader title={t('profile.title')} />

{#if !account}
	<div class="card">
		<p class="text-body text-muted">{t('error.accountNotFound')}</p>
	</div>
{:else}
	<div class="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[21rem_minmax(0,1fr)]">
		<aside class="page-stack lg:sticky lg:top-[var(--anchor-offset)]">
			<section class="scoreboard p-5">
				<div class="flex items-start gap-4">
					{#if profile}
						<Avatar player={profile} size={64} />
					{:else}
						<span
							class="grid h-16 w-16 shrink-0 place-items-center rounded-pill border border-paper/25 bg-paper/10 text-section font-semibold tracking-tight"
						>
							{initials}
						</span>
					{/if}
					<div class="min-w-0">
						<p class="break-words text-section font-semibold leading-tight">
							{account.name}
						</p>
						<p class="mt-1 break-all text-body text-paper/70">{account.email}</p>
					</div>
				</div>

				<div class="mt-4 flex flex-wrap gap-2">
					<span class="stamp border-paper/25 text-paper/80">{roleLabel}</span>
					{#if profile}
						<span class="stamp border-paper/25 text-paper/80">
							{t(positionDefinition(profile.position).labelKey)}
							{#if profile.jerseyNumber}
								· #{profile.jerseyNumber}
							{/if}
						</span>
					{/if}
					{#if legend}
						<span class="stamp border-paper/25 text-paper/80">
							{t('profile.legendIdentity', {
								name: legend.name,
								number: legend.number,
								era: legend.era
							})}
						</span>
					{/if}
				</div>

				<p class="mt-5 border-t border-paper/10 pt-3 text-meta text-paper/55">
					{t('profile.memberSince', { date: formatMonthYear(account.createdAt) })}
				</p>
			</section>

			{#if data.balance}
				<a href="/solde" class="card card-link flex items-center justify-between gap-3">
					<div class="min-w-0">
						<p class="text-meta font-semibold text-muted">{t('profile.balance')}</p>
						<p class="numeric mt-1 text-figure text-ink">
							{formatMoney(data.balance.outstandingCents, data.balance.currency)}
						</p>
					</div>
					{#if data.balance.outstandingCents === 0}
						<span class="badge-ok">{t('home.balanceClear')}</span>
					{:else if data.balance.isOverdue}
						<span class="badge-alert">{t('balance.status.overdue')}</span>
					{:else}
						<span class="badge-ice">{t('home.balanceDue')}</span>
					{/if}
				</a>
			{/if}

			<nav
				aria-label={t('profile.sections')}
				class="grid grid-cols-2 gap-1 border-y border-line bg-paper py-1.5 lg:grid-cols-1 lg:border-0 lg:bg-transparent lg:py-0"
			>
				{#each sections as item (item.id)}
					{@const current = currentHash === `#${item.id}`}
					<a
						href="#{item.id}"
						class="flex min-h-11 items-center border-l-[3px] px-2.5 text-body font-medium no-underline transition-colors {current
							? 'border-ice bg-ice-soft text-ice-deep'
							: 'border-transparent text-muted hover:bg-ice-soft/60 hover:text-ink'}"
						aria-current={current ? 'location' : undefined}
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</aside>

		<div class="grid gap-4 lg:items-start xl:grid-cols-[minmax(0,1fr)_20rem]">
			<div class="page-stack min-w-0">
				<div id="compte" class="scroll-mt-[var(--anchor-offset)]">
					<SectionCard title={t('profile.account')}>
						<p class="hint">{t('profile.accountHelp')}</p>
						<FormFeedback {form} section="compte" class="mt-3" />

						{#if profile}
							<dl class="mt-3">
								<div class="fact">
									<dt>{t('profile.displayName')}</dt>
									<dd>{account.name}</dd>
								</div>
								<div class="fact">
									<dt>{t('profile.email')}</dt>
									<dd>{account.email}</dd>
								</div>
							</dl>
							<p class="hint mt-2">{t('profile.playerNameManaged')}</p>
						{:else}
							<form method="POST" action="?/identity" use:progressiveForm class="mt-3 space-y-3">
								<div>
									<label class="label" for="displayName">{t('profile.displayName')}</label>
									<input
										class="input"
										id="displayName"
										name="displayName"
										value={account.name}
										maxlength={ACCOUNT_LIMITS.displayNameMax}
										autocomplete="name"
										required
									/>
									<p class="hint">{t('profile.displayNameHelp')}</p>
								</div>
								<dl class="fact">
									<dt>{t('profile.email')}</dt>
									<dd>{account.email}</dd>
								</dl>
								<p class="hint">{t('profile.emailReadOnly')}</p>
								<button class="btn-primary" type="submit">{t('common.save')}</button>
							</form>
						{/if}
					</SectionCard>
				</div>

				{#if profile}
					<div id="joueur" class="scroll-mt-[var(--anchor-offset)]">
						<SectionCard title={t('profile.playerSection')}>
							<p class="hint">{t('profile.playerSectionHelp')}</p>
							<FormFeedback {form} section="joueur" class="mt-3" />
							<form
								method="POST"
								action="?/profile"
								use:progressiveForm
								class="mt-4 grid gap-4 sm:grid-cols-2"
							>
								<div>
									<label class="label" for="firstName">{t('profile.firstName')}</label>
									<input
										class="input"
										id="firstName"
										name="firstName"
										value={profile.firstName}
										required
										maxlength={data.limits.nameMax}
										autocomplete="given-name"
									/>
								</div>
								<div>
									<label class="label" for="lastName">{t('profile.lastName')}</label>
									<input
										class="input"
										id="lastName"
										name="lastName"
										value={profile.lastName}
										required
										maxlength={data.limits.nameMax}
										autocomplete="family-name"
									/>
								</div>
								<div>
									<label class="label" for="age">{t('profile.age')}</label>
									<input
										class="input"
										id="age"
										name="age"
										type="number"
										inputmode="numeric"
										min={data.limits.ageMin}
										max={data.limits.ageMax}
										value={profile.age}
										required
									/>
									<p class="hint">{t('profile.ageHelp')}</p>
								</div>
								<dl class="fact">
									<dt>{t('position.label')}</dt>
									<dd>{t(positionDefinition(profile.position).labelKey)}</dd>
								</dl>
								<p class="hint">{t('profile.positionManaged')}</p>
								<div>
									<label class="label" for="jerseyNumber">{t('profile.jersey')}</label>
									<input
										class="input"
										id="jerseyNumber"
										name="jerseyNumber"
										type="number"
										inputmode="numeric"
										min={data.limits.jerseyMin}
										max={data.limits.jerseyMax}
										value={profile.jerseyNumber ?? ''}
										placeholder={String(data.limits.jerseyExample)}
									/>
									<p class="hint">
										{t('profile.jerseyHelp', {
											min: data.limits.jerseyMin,
											max: data.limits.jerseyMax
										})}
									</p>
								</div>
								<div class="sm:col-span-2">
									{#if data.avatarPicker && IdentityDisclosure && profile}
										<IdentityDisclosure
											selected={data.avatarPicker.selected}
											taken={data.avatarPicker.taken}
											position={position}
											player={profile}
											legendName={data.legend?.name ?? null}
										/>
									{/if}
								</div>
								<div class="sm:col-span-2">
									<button class="btn-primary" type="submit">{t('common.save')}</button>
								</div>
							</form>
							{#if !canSeeRatings}
								<p class="hint mt-4 border-t border-line pt-4">{t('profile.ratingsHidden')}</p>
							{/if}
						</SectionCard>
					</div>

					{#if data.isSubstitute}
						<div id="positions" class="scroll-mt-[var(--anchor-offset)]">
							<SectionCard title={t('subs.positions')}>
								<p class="hint">{t('subs.positionsHelp')}</p>
								<FormFeedback {form} section="positions" class="mt-3" />
								<form method="POST" action="?/positions" use:progressiveForm class="mt-4 space-y-4">
									{#if PositionChips}
										<PositionChips
											name="positions"
											selected={data.positions}
											legend={t('subs.positions')}
										/>
									{/if}
									<button class="btn-primary" type="submit">{t('common.save')}</button>
								</form>
							</SectionCard>
						</div>
					{/if}
				{/if}

				{#if !profile && isManager}
					<SectionCard title={t('profile.playerSection')}>
						<p class="text-body text-muted">{t('profile.noPlayerSheetAdmin')}</p>
						{#if data.nav.canManagePlayers}
							<a class="btn-secondary btn-sm mt-3" href="/admin/joueurs">
								{t('profile.createPlayerSheet')}
							</a>
						{/if}
					</SectionCard>
				{/if}
			</div>

			<div class="page-stack min-w-0">
				{#if data.stats}
					<div id="stats" class="scroll-mt-[var(--anchor-offset)]">
						<SectionCard title={t('stats.title')}>
							{#if data.stats.games === 0}
								<p class="text-body text-muted">{t('stats.empty')}</p>
							{:else}
								{#if StatStrip}
									<StatStrip cells={statsCells} />
								{/if}
								<p class="mt-3 text-body">
									{t('stats.perGame', {
										value: formatDecimal(data.stats.pointsPerGame, 2)
									})}
								</p>
							{/if}
							<p class="hint mt-3">{t('stats.help')}</p>
						</SectionCard>
					</div>
				{/if}

				<div id="notifications" class="scroll-mt-[var(--anchor-offset)]">
					<SectionCard title={t('profile.notifications')}>
						<p class="hint">{t('profile.notificationsHelp')}</p>
						<FormFeedback {form} section="notifications" class="mt-3" />
						<form method="POST" action="?/notifications" use:progressiveForm class="mt-4 space-y-3">
							<label class="flex min-h-11 items-center gap-3 text-body font-medium">
								<input
									type="checkbox"
									name="emailEnabled"
									checked={data.notifications.emailEnabled}
									class="h-4 w-4"
								/>
								{t('profile.emailNotifications')}
							</label>
							<label class="flex min-h-11 items-center gap-3 text-body font-medium">
								<input
									type="checkbox"
									name={pushPreference.disabled ? undefined : 'pushEnabled'}
									checked={pushPreference.checked}
									disabled={pushPreference.disabled}
									aria-describedby={pushPreference.hint ? 'push-preference-help' : undefined}
									class="h-4 w-4"
								/>
								{t('profile.pushNotifications')}
							</label>
							{#if pushPreference.disabled}
								<input
									type="hidden"
									name="pushEnabled"
									value={data.notifications.pushEnabled ? 'on' : ''}
								/>
								<p id="push-preference-help" class="hint">
									{t('profile.pushPreferenceHelp')}
								</p>
							{/if}
							<button class="btn-primary" type="submit">{t('common.save')}</button>
						</form>

						<div class="mt-5 border-t border-line pt-4">
							{#if pushStatus === 'unsupported'}
								<p class="hint">{t('profile.pushUnsupported')}</p>
							{:else if pushStatus === 'unconfigured'}
								<p class="hint">{t('profile.pushUnconfigured')}</p>
							{:else if isIos}
								<p class="hint">{t('profile.pushIosInstall')}</p>
							{:else if pushStatus === 'denied'}
								<p class="notice">{t('profile.pushDenied')}</p>
							{:else if pushStatus === 'on'}
								<div class="flex flex-wrap items-center gap-2">
									<span class="badge-ok">{t('profile.pushEnabled')}</span>
									<button class="btn-ghost btn-sm" type="button" onclick={disablePush}>
										{t('profile.pushDisable')}
									</button>
								</div>
							{:else if pushStatus === 'off'}
								<button class="btn-primary btn-sm" type="button" onclick={enablePush}>
									{t('profile.pushEnable')}
								</button>
							{:else}
								<p class="hint">{t('common.loading')}</p>
							{/if}
							{#if pushError}
								<p class="field-error" role="alert">{pushError}</p>
							{/if}
						</div>

						<div class="mt-5 border-t border-line pt-4">
							<a class="btn-secondary btn-sm" href="/notifications">
								{t('profile.notificationsInbox')}
							</a>
							<p class="hint">{t('profile.inboxHelp')}</p>
						</div>
					</SectionCard>
				</div>

				<div id="securite" class="scroll-mt-[var(--anchor-offset)]">
					<SectionCard title={t('profile.security')}>
						<p class="hint">{t('profile.securityHelp')}</p>
						<FormFeedback {form} section="securite" class="mt-3" />

						<details class="mt-4">
							<summary
								class="link flex min-h-11 cursor-pointer list-none items-center text-body font-semibold marker:content-none"
							>
								{t('profile.changePassword')}
							</summary>
							<form method="POST" action="?/password" use:progressiveForm class="mt-1 space-y-4">
								{#if PasswordField}
									<PasswordField
										id="currentPassword"
										name="currentPassword"
										label={t('profile.currentPassword')}
										autocomplete="current-password"
										error={passwordError}
									/>
									<PasswordField
										id="newPassword"
										name="newPassword"
										label={t('profile.newPassword')}
										autocomplete="new-password"
										minlength={data.minLength}
										hint={t('invite.tooShort', { count: data.minLength })}
										error={fieldErrorFor(form, 'securite', 'newPassword')}
									/>
									<PasswordField
										id="confirmPassword"
										name="confirm"
										label={t('invite.confirm')}
										autocomplete="new-password"
										error={fieldErrorFor(form, 'securite', 'confirmPassword')}
									/>
								{/if}
								<button class="btn-primary" type="submit">{t('common.save')}</button>
							</form>
						</details>

						<div class="mt-5 border-t border-line pt-4">
							<h3 class="text-subhead">{t('profile.sessions')}</h3>
							<p class="hint">{t('profile.sessionsHelp')}</p>
							<ul role="list" class="mt-3 divide-y divide-line">
								{#if currentSession}
									<li class="py-3">
										<div class="flex flex-wrap items-center justify-between gap-2">
											<div class="min-w-0">
												<p class="break-words text-body font-semibold">
													{deviceLabel(currentSession.userAgent)}
												</p>
												<p class="hint">
													{formatTimestamp(currentSession.updatedAt)}
												</p>
											</div>
											<span class="badge-ok">{t('profile.currentDevice')}</span>
										</div>
									</li>
								{/if}
								{#each otherSessions.slice(0, 2) as session (session.id)}
									<li class="py-3">
										<div class="min-w-0">
											<p class="break-words text-body font-semibold">
												{deviceLabel(session.userAgent)}
											</p>
											<p class="hint">
												{formatTimestamp(session.updatedAt)}
											</p>
										</div>
									</li>
								{/each}
							</ul>

							{#if otherSessions.length > 2}
								<details class="mt-1">
									<summary
										class="link flex min-h-11 cursor-pointer list-none items-center text-body marker:content-none"
									>
										{formatCount(
											otherSessions.length - 2,
											'profile.moreSessions.one',
											'profile.moreSessions.many'
										)}
									</summary>
									<ul role="list" class="divide-y divide-line">
										{#each otherSessions.slice(2) as session (session.id)}
											<li class="py-3">
												<p class="break-words text-body font-semibold">
													{deviceLabel(session.userAgent)}
												</p>
												<p class="hint">{formatTimestamp(session.updatedAt)}</p>
											</li>
										{/each}
									</ul>
								</details>
							{/if}

							{#if otherSessions.length > 0}
								<form method="POST" action="?/sessions" use:progressiveForm class="mt-3">
									{#if ConfirmSubmit}
										<ConfirmSubmit
											label={t('profile.revokeOthers')}
											question={t('profile.revokeOthersConfirm')}
										/>
									{/if}
								</form>
							{:else}
								<p class="hint mt-3">{t('profile.noOtherSessions')}</p>
							{/if}
						</div>

						<div class="mt-5 border-t border-line pt-4">
							<p class="hint">{t('profile.signOutHelp')}</p>
							<form method="POST" action="/deconnexion" class="mt-2">
								<button class="btn-secondary" type="submit">{t('nav.logout')}</button>
							</form>
						</div>
					</SectionCard>
				</div>

				<div class="lg:hidden">
					{#if InstallPrompt}
						<InstallPrompt variant="full" />
					{/if}
				</div>

				{#if isManager}
					<div id="administration" class="scroll-mt-[var(--anchor-offset)]">
						<SectionCard title={t('profile.adminSection')}>
							<p class="hint">{t('profile.adminHelp')}</p>
							<div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
								{#each managementLinks as link (link.href)}
									<a class="btn-secondary justify-start" href={link.href}>{t(link.labelKey)}</a>
								{/each}
							</div>
						</SectionCard>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
