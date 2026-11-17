<script lang="ts">
	import { onDestroy } from 'svelte';
	import { LOCATION_LIMITS } from '#config/games.ts';
	import { ADDRESS_SEARCH } from '#config/maps.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	type AddressSuggestion = {
		id: string;
		label: string;
		mapUrl: string;
	};

	type SearchState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

	let {
		id,
		label = t('admin.locationAddress'),
		name = 'address',
		mapUrlName = 'mapUrl',
		value = '',
		mapUrl = ''
	}: {
		id: string;
		label?: string;
		name?: string;
		mapUrlName?: string;
		value?: string;
		mapUrl?: string;
	} = $props();

	const listId = $derived(`${id}-suggestions`);
	// svelte-ignore state_referenced_locally
	let query = $state(value);
	// svelte-ignore state_referenced_locally
	let mapUrlValue = $state(mapUrl);
	let suggestions = $state<AddressSuggestion[]>([]);
	let status = $state<SearchState>('idle');
	let open = $state(false);
	let activeIndex = $state(-1);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;
	let serial = 0;
	let lastValue: string | undefined;
	let lastMapUrl: string | undefined;
	let root = $state<HTMLDivElement>();

	// The owning form resets its fields after a successful create; internal
	// state must follow, including the hidden map link. A listener on the form
	// itself is reliable even when the reset event does not bubble.
	$effect(() => {
		const form = root?.closest('form');
		if (!form) return;
		const listener = () => handleReset();
		form.addEventListener('reset', listener);
		return () => form.removeEventListener('reset', listener);
	});

	// The server is the source of truth after a save: adopt prop changes without
	// interrupting a member who is still typing in the field.
	$effect(() => {
		if (lastValue !== undefined && value !== lastValue) query = value;
		lastValue = value;
		if (lastMapUrl !== undefined && mapUrl !== lastMapUrl) mapUrlValue = mapUrl;
		lastMapUrl = mapUrl;
	});

	const showPanel = $derived(
		open &&
			(status === 'loading' ||
				status === 'error' ||
				status === 'empty' ||
				suggestions.length > 0)
	);

	onDestroy(() => {
		if (timer) clearTimeout(timer);
		controller?.abort();
	});

	function isSuggestion(value: unknown): value is AddressSuggestion {
		if (!value || typeof value !== 'object') return false;
		const candidate = value as Record<string, unknown>;
		return (
			typeof candidate.id === 'string' &&
			typeof candidate.label === 'string' &&
			typeof candidate.mapUrl === 'string'
		);
	}

	function cancelPending(): void {
		if (timer) clearTimeout(timer);
		timer = undefined;
		controller?.abort();
		controller = undefined;
		// A response that arrives after a dismissal must not reopen the panel.
		serial += 1;
	}

	function schedule(): void {
		if (timer) clearTimeout(timer);
		const term = query.trim();
		if (term.length < ADDRESS_SEARCH.minChars) {
			suggestions = [];
			status = 'idle';
			open = false;
			return;
		}
		// A new search never offers the previous addresses: Enter must not
		// commit a row that is no longer on screen.
		suggestions = [];
		activeIndex = -1;
		status = 'loading';
		open = true;
		timer = setTimeout(() => void run(term), 250);
	}

	async function run(term: string): Promise<void> {
		controller?.abort();
		const current = new AbortController();
		controller = current;
		const requestId = ++serial;
		try {
			const response = await fetch(
				`/api/address-search?q=${encodeURIComponent(term)}`,
				{ signal: current.signal, headers: { accept: 'application/json' } }
			);
			if (!response.ok) throw new Error(`address-search ${response.status}`);
			const payload = (await response.json()) as { results?: unknown };
			if (requestId !== serial) return;
			suggestions = Array.isArray(payload.results)
				? payload.results.filter(isSuggestion)
				: [];
			status = suggestions.length > 0 ? 'ready' : 'empty';
			open = true;
			activeIndex = -1;
		} catch {
			if (current.signal.aborted || requestId !== serial) return;
			suggestions = [];
			status = 'error';
			open = true;
		}
	}

	function handleInput(event: Event): void {
		query = (event.currentTarget as HTMLInputElement).value;
		// A manually edited address must not keep the coordinates of the last
		// suggestion; the saved map link falls back to the address search.
		mapUrlValue = '';
		activeIndex = -1;
		schedule();
	}

	function select(suggestion: AddressSuggestion): void {
		cancelPending();
		query = suggestion.label;
		mapUrlValue = suggestion.mapUrl;
		suggestions = [];
		status = 'idle';
		open = false;
		activeIndex = -1;
	}

	function handleFocus(): void {
		if (status === 'ready' && suggestions.length > 0) open = true;
	}

	function handleBlur(): void {
		cancelPending();
		open = false;
		activeIndex = -1;
	}

	/** A form reset restores the declared default; internal state follows it. */
	function handleReset(): void {
		cancelPending();
		query = value;
		mapUrlValue = mapUrl;
		suggestions = [];
		status = 'idle';
		open = false;
		activeIndex = -1;
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (status === 'ready' && suggestions.length > 0) {
				open = true;
				activeIndex = (activeIndex + 1) % suggestions.length;
			}
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (status === 'ready' && suggestions.length > 0) {
				open = true;
				activeIndex =
					activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1;
			}
			return;
		}
		if (event.key === 'Enter' && open && activeIndex >= 0) {
			const suggestion = suggestions[activeIndex];
			if (suggestion) {
				event.preventDefault();
				select(suggestion);
			}
			return;
		}
		if (event.key === 'Escape') {
			cancelPending();
			suggestions = [];
			status = 'idle';
			open = false;
			activeIndex = -1;
		}
	}
</script>

<div class="relative min-w-0" bind:this={root}>
	<label class="label" for={id}>{label}</label>
	<input
		class="input"
		{id}
		{name}
		value={query}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onfocus={handleFocus}
		onblur={handleBlur}
		maxlength={LOCATION_LIMITS.addressMax}
		autocomplete="off"
		spellcheck="false"
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={showPanel}
		aria-controls={status === 'ready' ? listId : undefined}
		aria-activedescendant={status === 'ready' && activeIndex >= 0
			? `${id}-option-${activeIndex}`
			: undefined}
	/>
	<input type="hidden" name={mapUrlName} value={mapUrlValue} />
	<p class="hint">{t('admin.locationAddressHelp')}</p>

	{#if showPanel}
		<div
			class="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-control border border-line bg-surface shadow-lift"
		>
			{#if status === 'loading'}
				<p class="px-3 py-2 text-body text-muted" role="status">
					{t('admin.addressSearching')}
				</p>
			{:else if status === 'error'}
				<p class="px-3 py-2 text-body text-muted" role="status">
					{t('admin.addressSearchUnavailable')}
				</p>
			{:else if status === 'empty'}
				<p class="px-3 py-2 text-body text-muted" role="status">
					{t('admin.addressNoResult')}
				</p>
			{:else}
				<ul
					id={listId}
					role="listbox"
					class="max-h-64 overflow-auto py-1"
					aria-label={t('admin.addressSuggestions')}
				>
					{#each suggestions as suggestion, index (suggestion.id)}
						<li
							id="{id}-option-{index}"
							role="option"
							aria-selected={index === activeIndex}
							class="aria-selected:bg-ice-soft"
						>
							<button
								type="button"
								tabindex="-1"
								class="min-h-11 w-full cursor-pointer px-3 py-2 text-left text-body leading-snug hover:bg-ice-soft/60"
								onpointerdown={(event) => event.preventDefault()}
								onclick={() => select(suggestion)}
							>
								{suggestion.label}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
