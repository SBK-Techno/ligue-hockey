<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { browser } from '$app/env';
	import { PLAYER_LIMITS } from '#config/players.ts';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { formatMoney, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let pushStatus = $state<'checking' | 'off' | 'on' | 'denied' | 'unsupported'>('checking');
	let pushError = $state<string | null>(null);

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
			pushStatus = 'unsupported';
			return;
		}
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		pushStatus = subscription ? 'on' : 'off';
	});

	async function enablePush() {
		pushError = null;
		try {
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
			pushError = t('profile.pushDenied');
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
		browser && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches
	);
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1>{t('profile.title')}</h1>
		<p class="mt-1 text-sm text-muted">
			{data.profile?.fullName}
			{#if data.profile}
				· {t(positionDefinition(data.profile.position).labelKey)}
				· {data.profile.age} {t('common.years')}
			{/if}
		</p>
	</div>
	{#if data.isSubstitute}
		<span class="badge-ice">{t('profile.substitute')}</span>
	{/if}
</div>

{#if data.balance}
	<a href="/solde" class="card mb-5 flex items-center justify-between gap-3 no-underline hover:border-ice">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t('profile.balance')}</p>
			<p class="mt-1 font-display text-2xl font-bold text-ink">
				{formatMoney(data.balance.outstandingCents, data.balance.currency)}
			</p>
		</div>
		{#if data.balance.isOverdue}
			<span class="badge-alert">{t('balance.status.overdue')}</span>
		{:else}
			<span class="badge-ok">{t('home.balanceClear')}</span>
		{/if}
	</a>
{/if}

<section class="card mb-4">
	<h2 class="mb-4">{t('profile.subtitle')}</h2>
	<form method="POST" action="?/profile" use:enhance class="grid gap-4 sm:grid-cols-2">
		<div>
			<label class="label" for="firstName">{t('profile.firstName')}</label>
			<input
				class="input"
				id="firstName"
				name="firstName"
				value={data.profile?.firstName}
				required
				maxlength={PLAYER_LIMITS.nameMax}
			/>
		</div>
		<div>
			<label class="label" for="lastName">{t('profile.lastName')}</label>
			<input
				class="input"
				id="lastName"
				name="lastName"
				value={data.profile?.lastName}
				required
				maxlength={PLAYER_LIMITS.nameMax}
			/>
		</div>
		<div>
			<label class="label" for="age">{t('profile.age')}</label>
			<input
				class="input"
				id="age"
				name="age"
				type="number"
				min={PLAYER_LIMITS.ageMin}
				max={PLAYER_LIMITS.ageMax}
				value={data.profile?.age}
				required
			/>
		</div>
		<div>
			<label class="label" for="email">{t('profile.email')}</label>
			<input class="input" id="email" value={data.profile?.email ?? ''} disabled />
		</div>
		<div class="sm:col-span-2">
			<button class="btn-primary" type="submit">{t('common.save')}</button>
		</div>
	</form>
	<p class="hint mt-3">{t('profile.ratingsHidden')}</p>
</section>

{#if data.isSubstitute}
	<section class="card mb-4">
		<h2>{t('subs.positions')}</h2>
		<p class="mt-1 text-sm text-muted">{t('subs.positionsHelp')}</p>
	<form method="POST" action="?/positions" use:enhance class="mt-4">
		<div class="flex flex-wrap gap-2">
			{#each POSITIONS as position (position.key)}
				<label
					class="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium has-[:checked]:border-ice has-[:checked]:bg-ice-soft"
				>
					<input
						type="checkbox"
						name="positions"
						value={position.key}
						checked={(data.positions as string[]).includes(position.key)}
						class="h-4 w-4 accent-[var(--color-ice)]"
					/>
					{t(position.labelKey)}
				</label>
			{/each}
		</div>
		<button class="btn-secondary btn-sm mt-4" type="submit">{t('common.save')}</button>
	</form>
	</section>
{/if}

<section class="card mb-4" id="notifications">
	<h2>{t('profile.notifications')}</h2>
	<form method="POST" action="?/notifications" use:enhance class="mt-4 space-y-3">
		<label class="flex items-center gap-3 text-sm font-medium">
			<input
				type="checkbox"
				name="emailEnabled"
				checked={data.notifications.emailEnabled}
				class="h-4 w-4 accent-[var(--color-ice)]"
			/>
			{t('profile.emailNotifications')}
		</label>
		<label class="flex items-center gap-3 text-sm font-medium">
			<input
				type="checkbox"
				name="pushEnabled"
				checked={data.notifications.pushEnabled}
				class="h-4 w-4 accent-[var(--color-ice)]"
			/>
			{t('profile.pushNotifications')}
		</label>
		<button class="btn-secondary btn-sm" type="submit">{t('common.save')}</button>
	</form>

	<div class="mt-5 border-t border-line pt-4">
		{#if pushStatus === 'unsupported'}
			<p class="hint">{t('profile.pushUnsupported')}</p>
		{:else if isIos}
			<p class="hint">{t('profile.pushIosInstall')}</p>
		{:else if pushStatus === 'denied'}
			<p class="alert">{t('profile.pushDenied')}</p>
		{:else if pushStatus === 'on'}
			<div class="flex flex-wrap items-center gap-2">
				<span class="badge-ok">{t('profile.pushEnabled')}</span>
				<button class="btn-ghost btn-sm" type="button" onclick={disablePush}>
					{t('common.delete')}
				</button>
			</div>
		{:else if pushStatus === 'off'}
			<button class="btn-primary btn-sm" type="button" onclick={enablePush}>
				{t('profile.pushEnable')}
			</button>
		{/if}
		{#if pushError}
			<p class="field-error">{pushError}</p>
		{/if}
	</div>
</section>

<form method="POST" action="/deconnexion" class="sm:hidden">
	<button class="btn-secondary w-full" type="submit">{t('nav.logout')}</button>
</form>
