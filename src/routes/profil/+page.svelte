<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/env';
	import { ACCOUNT_LIMITS } from '#config/account.ts';
	import { PLAYER_LIMITS } from '#config/players.ts';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { roleDefinition } from '#config/roles.ts';
	import { formatMonthYear, formatMoney, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import InstallPrompt from '#lib/ui/InstallPrompt.svelte';
	import PasswordField from '#lib/ui/PasswordField.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import { managementTabs } from '#lib/domain/auth/destinations.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
	const account = $derived(data.account);
	const profile = $derived(data.profile);
	const isManager = $derived(actor !== null && can(actor, 'viewAdmin'));
	const canSeeRatings = $derived(actor !== null && can(actor, 'editRatings'));
	const managementLinks = $derived(actor ? managementTabs(actor) : []);
	const roleLabel = $derived(
		account ? t(roleDefinition(account.role)?.labelKey ?? 'admin.role.player') : ''
	);
	const initials = $derived(account ? monogram(account.name) : '');
	const otherSessions = $derived(
		data.sessions.filter((session) => session.id !== data.currentSessionId)
	);
	const currentSession = $derived(
		data.sessions.find((session) => session.id === data.currentSessionId)
	);

	let pushStatus = $state<
		'checking' | 'off' | 'on' | 'denied' | 'unsupported' | 'unconfigured'
	>('checking');
	let pushError = $state<string | null>(null);

	function monogram(name: string): string {
		return name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');
	}

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

	const sections = $derived([
		{ id: 'compte', label: t('profile.tab.account') },
		...(profile ? [{ id: 'joueur', label: t('profile.tab.player') }] : []),
		{ id: 'notifications', label: t('profile.tab.notifications') },
		{ id: 'securite', label: t('profile.tab.security') },
		...(isManager ? [{ id: 'administration', label: t('profile.tab.admin') }] : [])
	]);
</script>

<FormFeedback {form} class="mb-4" />

<h1 class="sr-only">{t('profile.title')}</h1>

{#if !account}
	<div class="card">
		<p class="text-sm text-muted">{t('error.accountNotFound')}</p>
	</div>
{:else}
	<div class="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start lg:gap-8">
		<aside
			class="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
		>
			<section class="relative overflow-hidden rounded-card bg-ink p-5 text-paper">
				<svg
					aria-hidden="true"
					viewBox="0 0 600 600"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="pointer-events-none absolute -right-20 -top-24 h-72 w-72 text-paper/[0.08]"
				>
					<circle cx="300" cy="300" r="232" />
					<circle cx="300" cy="300" r="92" />
					<path d="M0 300h600M300 0v600" />
					<circle cx="300" cy="300" r="7" fill="currentColor" stroke="none" />
					<path d="M68 208h56v184H68M532 208h-56v184h56" />
				</svg>

				<div class="relative flex items-start gap-4">
					<span
						class="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-paper/25 bg-paper/10 font-display text-2xl font-bold tracking-tight"
					>
						{initials}
					</span>
					<div class="min-w-0">
						<p class="break-words font-display text-2xl font-bold leading-tight">
							{account.name}
						</p>
						<p class="mt-1 break-all text-sm text-paper/65">{account.email}</p>
					</div>
				</div>

				<div class="relative mt-4 flex flex-wrap gap-2">
					<span class="rounded-full border border-paper/25 px-2.5 py-1 text-[11px] font-semibold">
						{roleLabel}
					</span>
					{#if profile}
						<span class="rounded-full border border-paper/25 px-2.5 py-1 text-[11px] font-semibold">
							{t(positionDefinition(profile.position).labelKey)}
							{#if profile.jerseyNumber}
								· #{profile.jerseyNumber}
							{/if}
						</span>
					{/if}
				</div>

				<p class="relative mt-5 border-t border-paper/10 pt-3 text-xs text-paper/55">
					{t('profile.memberSince', { date: formatMonthYear(account.createdAt) })}
				</p>
			</section>

			{#if data.balance}
				<a href="/solde" class="card card-link flex items-center justify-between gap-3">
					<div class="min-w-0">
						<p class="text-xs font-semibold text-muted">{t('profile.balance')}</p>
						<p class="mt-1 font-display text-2xl font-bold leading-none text-ink">
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

			<nav aria-label={t('profile.sections')} class="flex flex-wrap gap-1 pb-1 lg:flex-col lg:pb-0">
				{#each sections as section (section.id)}
					<a
						href="#{section.id}"
						class="whitespace-nowrap rounded-control px-3 py-2 text-sm font-semibold text-muted no-underline transition-colors hover:bg-ink/5 hover:text-ink"
					>
						{section.label}
					</a>
				{/each}
			</nav>

			<div class="hidden lg:block">
				<p class="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
					{t('profile.quickLinks')}
				</p>
				<ul role="list" class="space-y-1 text-sm">
					<li><a class="link" href="/matchs">{t('nav.games')}</a></li>
					<li><a class="link" href="/remplacants">{t('subs.title')}</a></li>
					<li><a class="link" href="/discussion">{t('nav.chat')}</a></li>
					<li><a class="link" href="/notifications">{t('profile.inbox')}</a></li>
				</ul>
			</div>
		</aside>

		<div class="mt-4 space-y-4 lg:mt-0">
			<section id="compte" class="card scroll-mt-24">
				<h2>{t('profile.account')}</h2>
				<p class="hint mt-1">{t('profile.accountHelp')}</p>

				{#if profile}
					<dl class="mt-4 grid gap-3 sm:grid-cols-2">
						<div class="min-w-0">
							<dt class="label">{t('profile.displayName')}</dt>
							<dd class="break-words text-sm">{account.name}</dd>
						</div>
						<div class="min-w-0">
							<dt class="label">{t('profile.email')}</dt>
							<dd class="break-all text-sm">{account.email}</dd>
						</div>
					</dl>
					<p class="hint mt-3">{t('profile.playerNameManaged')}</p>
				{:else}
					<form method="POST" action="?/identity" use:progressiveForm class="mt-4 space-y-4">
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
						<div>
							<p class="label">{t('profile.email')}</p>
							<p class="break-all text-sm">{account.email}</p>
							<p class="hint">{t('profile.emailReadOnly')}</p>
						</div>
						<button class="btn-primary" type="submit">{t('common.save')}</button>
					</form>
				{/if}
			</section>

			{#if profile}
				<section id="joueur" class="card scroll-mt-24">
					<h2>{t('profile.playerSection')}</h2>
					<p class="hint mt-1">{t('profile.playerSectionHelp')}</p>
					<form method="POST" action="?/profile" use:progressiveForm class="mt-5 grid gap-4 sm:grid-cols-2">
						<div>
							<label class="label" for="firstName">{t('profile.firstName')}</label>
							<input
								class="input"
								id="firstName"
								name="firstName"
								value={profile.firstName}
								required
								maxlength={PLAYER_LIMITS.nameMax}
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
								maxlength={PLAYER_LIMITS.nameMax}
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
								min={PLAYER_LIMITS.ageMin}
								max={PLAYER_LIMITS.ageMax}
								value={profile.age}
								required
							/>
							<p class="hint">{t('profile.ageHelp')}</p>
						</div>
						<div>
							<label class="label" for="position">{t('position.label')}</label>
							<select class="input" id="position" name="position" required>
								{#each POSITIONS as position (position.key)}
									<option value={position.key} selected={profile.position === position.key}>
										{t(position.labelKey)}
									</option>
								{/each}
							</select>
							<p class="hint">{t('profile.positionHelp')}</p>
						</div>
						<div>
							<label class="label" for="jerseyNumber">{t('profile.jersey')}</label>
							<input
								class="input"
								id="jerseyNumber"
								name="jerseyNumber"
								type="number"
								inputmode="numeric"
								min={PLAYER_LIMITS.jerseyMin}
								max={PLAYER_LIMITS.jerseyMax}
								value={profile.jerseyNumber ?? ''}
								placeholder={String(PLAYER_LIMITS.jerseyExample)}
							/>
							<p class="hint">{t('profile.jerseyHelp', { min: PLAYER_LIMITS.jerseyMin, max: PLAYER_LIMITS.jerseyMax })}</p>
						</div>
						<div class="sm:col-span-2">
							<button class="btn-primary" type="submit">{t('common.save')}</button>
						</div>
					</form>
					{#if !canSeeRatings}
						<p class="hint mt-4 border-t border-line/80 pt-4">
							{t('profile.ratingsHidden')}
						</p>
					{/if}
				</section>

				{#if data.isSubstitute}
					<section class="card">
						<h2>{t('subs.positions')}</h2>
						<p class="mt-1 text-sm text-muted">{t('subs.positionsHelp')}</p>
						<form method="POST" action="?/positions" use:progressiveForm class="mt-4">
							<div class="flex flex-wrap gap-2">
								{#each POSITIONS as position (position.key)}
									<label
										class="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line bg-paper px-3 py-2 text-sm font-medium transition-colors has-[:checked]:border-ice has-[:checked]:bg-ice-soft"
									>
										<input
											type="checkbox"
											name="positions"
											value={position.key}
											checked={data.positions.includes(position.key)}
											class="h-4 w-4"
										/>
										{t(position.labelKey)}
									</label>
								{/each}
							</div>
							<button class="btn-secondary btn-sm mt-4" type="submit">{t('common.save')}</button>
						</form>
					</section>
				{/if}
			{/if}

			<section id="notifications" class="card scroll-mt-24">
				<h2>{t('profile.notifications')}</h2>
				<p class="hint mt-1">{t('profile.notificationsHelp')}</p>
				<form method="POST" action="?/notifications" use:progressiveForm class="mt-4 space-y-3">
					<label class="flex items-center gap-3 text-sm font-medium">
						<input
							type="checkbox"
							name="emailEnabled"
							checked={data.notifications.emailEnabled}
							class="h-4 w-4"
						/>
						{t('profile.emailNotifications')}
					</label>
					<label class="flex items-center gap-3 text-sm font-medium">
						<input
							type="checkbox"
							name="pushEnabled"
							checked={data.notifications.pushEnabled}
							class="h-4 w-4"
						/>
						{t('profile.pushNotifications')}
					</label>
					<button class="btn-secondary btn-sm" type="submit">{t('common.save')}</button>
				</form>

				<div class="mt-5 border-t border-line/80 pt-4">
					{#if pushStatus === 'unsupported'}
						<p class="hint">{t('profile.pushUnsupported')}</p>
					{:else if pushStatus === 'unconfigured'}
						<p class="hint">{t('profile.pushUnconfigured')}</p>
					{:else if isIos}
						<p class="hint">{t('profile.pushIosInstall')}</p>
					{:else if pushStatus === 'denied'}
						<p class="alert">{t('profile.pushDenied')}</p>
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
						<p class="field-error">{pushError}</p>
					{/if}
				</div>

				<div class="mt-5 border-t border-line/80 pt-4">
					<a class="btn-secondary btn-sm" href="/notifications">
						{t('profile.notificationsInbox')}
					</a>
					<p class="hint">{t('profile.inboxHelp')}</p>
				</div>
			</section>

			<div class="lg:hidden">
				<InstallPrompt variant="full" />
			</div>

			<section id="securite" class="card scroll-mt-24">
				<h2>{t('profile.security')}</h2>
				<p class="hint mt-1">{t('profile.securityHelp')}</p>

				<form method="POST" action="?/password" use:progressiveForm class="mt-5 space-y-4">
					<h3 class="text-sm font-semibold">{t('profile.changePassword')}</h3>
					<PasswordField
						id="currentPassword"
						name="currentPassword"
						label={t('profile.currentPassword')}
						autocomplete="current-password"
					/>
					<PasswordField
						id="newPassword"
						name="newPassword"
						label={t('profile.newPassword')}
						autocomplete="new-password"
						minlength={data.minLength}
						hint={t('invite.tooShort', { count: data.minLength })}
					/>
					<PasswordField
						id="confirmPassword"
						name="confirm"
						label={t('invite.confirm')}
						autocomplete="new-password"
					/>
					<button class="btn-secondary" type="submit">{t('common.save')}</button>
				</form>

				<div class="mt-6 border-t border-line/80 pt-5">
					<h3 class="text-sm font-semibold">{t('profile.sessions')}</h3>
					<p class="hint">{t('profile.sessionsHelp')}</p>
					<ul role="list" class="mt-3 divide-y divide-line/70">
						{#if currentSession}
							<li class="py-3">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div class="min-w-0">
										<p class="break-words text-sm font-semibold">
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
						{#each otherSessions as session (session.id)}
							<li class="py-3">
								<div class="min-w-0">
									<p class="break-words text-sm font-semibold">
										{deviceLabel(session.userAgent)}
									</p>
									<p class="hint">
										{formatTimestamp(session.updatedAt)}
									</p>
								</div>
							</li>
						{/each}
					</ul>

					{#if otherSessions.length > 0}
						<form method="POST" action="?/sessions" use:progressiveForm class="mt-3">
							<ConfirmSubmit
								label={t('profile.revokeOthers')}
								question={t('profile.revokeOthersConfirm')}
								class="btn-secondary btn-sm"
							/>
						</form>
					{:else}
						<p class="hint mt-3">{t('profile.noOtherSessions')}</p>
					{/if}
				</div>

				<div class="mt-6 border-t border-line/80 pt-5">
					<p class="hint">{t('profile.signOutHelp')}</p>
					<form method="POST" action="/deconnexion" class="mt-2">
						<button class="btn-secondary" type="submit">{t('nav.logout')}</button>
					</form>
				</div>
			</section>

			{#if !profile && isManager}
				<section class="card">
					<h2>{t('profile.playerSection')}</h2>
					<p class="mt-1 text-sm text-muted">{t('profile.noPlayerSheetAdmin')}</p>
					{#if actor && can(actor, 'managePlayers')}
						<a class="btn-secondary btn-sm mt-3" href="/admin/joueurs">
							{t('profile.createPlayerSheet')}
						</a>
					{/if}
				</section>
			{/if}

			{#if isManager}
				<section id="administration" class="card scroll-mt-24">
					<h2>{t('profile.adminSection')}</h2>
					<p class="hint mt-1">{t('profile.adminHelp')}</p>
					<div class="mt-4 grid gap-2 sm:grid-cols-2">
						{#each managementLinks as link (link.href)}
							<a class="btn-secondary justify-start" href={link.href}>{t(link.labelKey)}</a>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</div>
{/if}
