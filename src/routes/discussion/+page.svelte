<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		CHAT_HISTORY_PREFETCH_PAGES,
		CHAT_POSITION_LOOKUP_PAGES,
		CHAT_SYNC_MAX_PAGES
	} from '#config/chat.ts';
	import { positionDefinition } from '#config/positions.ts';
	import type {
		ChatMessageView,
		ChatPage,
		ChatSyncPage
	} from '#lib/domain/chat/service.ts';
	import { branding } from '#lib/generated/branding.ts';
	import { formatDateHeading, formatTimeOfDay, t } from '#lib/shared/i18n/index.ts';
	import { decodeCursor, encodeCursor } from '#lib/shared/paging/cursor.ts';
	import { clock, toDate, todayInZone } from '#lib/shared/time/clock.ts';
	import Avatar from '#lib/ui/Avatar.svelte';
	import ChatMessageActions from '#lib/ui/ChatMessageActions.svelte';
	import ChatNewMessages from '#lib/ui/ChatNewMessages.svelte';
	import { chatControlName } from '#lib/ui/chat-controls.ts';
	import {
		applyDeletedIds,
		applyPollStates,
		compareChatMessages,
		mergeChatMessages
	} from '#lib/ui/chat-cache.ts';
	import { clearChatCache, readChatCache, writeChatMessages } from '#lib/ui/chat-cache-idb.ts';
	import { pollEntries } from '#lib/ui/chat-polls.ts';
	import {
		readChatPosition,
		writeChatPosition,
		type ChatPosition
	} from '#lib/ui/chat-position.ts';
	import { initialPillState, nextPillState } from '#lib/ui/chat-scroll.ts';
	import { publishChromeInset } from '#lib/ui/chrome-inset.svelte.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import { prefersReducedMotion, scrollBehavior } from '#lib/ui/scroll.ts';
	import type { PageProps } from './$types';

	type DayGroup = { key: string; label: string; messages: ChatMessageView[] };
	type StreamItem =
		| { kind: 'day'; key: string; label: string; pollsOnly: boolean }
		| { kind: 'message'; key: string; message: ChatMessageView };

	let { data, form }: PageProps = $props();
	let showPoll = $state(false);

	// Le compositeur collant s'ajoute à la barre mobile : sa hauteur mesurée
	// rejoint l'unique décalage composé par `layout.css`.
	let composerHeight = $state(0);

	$effect(() => {
		publishChromeInset('bottom', composerHeight);
		return () => publishChromeInset('bottom', 0);
	});

	// La liste part des limites du serveur; le membre la possède ensuite.
	// svelte-ignore state_referenced_locally
	let pollOptions = $state<string[]>(
		Array.from({ length: data.limits.pollMinOptions }, () => '')
	);

	// svelte-ignore state_referenced_locally
	const viewerId = data.viewerId;
	// Une position enregistrée n'existe que sur l'appareil : le serveur rend le
	// fil visible, puis le montage le masque avant la première peinture pour
	// rejoindre le message sans saut visible.
	const savedPosition = viewerId ? readChatPosition(viewerId) : null;
	let ready = $state(true);
	let hydrated = $state(false);
	// La sentinelle ne s'observe qu'une fois le cache posé et la lecture
	// rétablie : une page plus ancienne ne doit jamais tirer le lecteur
	// vers le haut pendant qu'il rejoint sa place.
	let settled = $state(false);
	// svelte-ignore state_referenced_locally
	let messages = $state<ChatMessageView[]>([...data.messages].reverse());
	// svelte-ignore state_referenced_locally
	let olderCursor = $state<string | null>(data.nextCursor);
	// svelte-ignore state_referenced_locally
	let complete = $state(data.nextCursor === null);
	let syncedAt = $state<number | null>(null);
	let loadingOlder = $state(false);
	let olderError = $state(false);
	let syncError = $state(false);
	let cacheError = $state(false);
	let sentinel = $state<HTMLElement>();
	// Un cache plus ancien que la page serveur laisse un trou entre les deux :
	// le montage le comble en arrière-plan, après avoir rendu la lecture.
	let pendingGapCursor: string | null = null;

	let syncing = false;
	let syncQueued = false;
	let saving = false;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	const abort = new AbortController();

	// Les sondages restent toujours chargés : un sondage peut arriver après le
	// premier rendu, et un import conditionnel le rendrait alors invisible.
	// Le fil vide est le seul cas où l'état vide existe, donc son îlot reste
	// conditionnel. La page ne change pas de données sans navigation, qui
	// reconstruit le module.
	// svelte-ignore state_referenced_locally
	const [EmptyState, PollOptions] = await Promise.all([
		data.messages.length === 0
			? import('#lib/ui/EmptyState.svelte').then((module) => module.default)
			: Promise.resolve(null),
		import('#lib/ui/PollOptions.svelte').then((module) => module.default)
	]);

	const canAddOption = $derived(pollOptions.length < data.limits.pollMaxOptions);
	const polls = $derived(pollEntries(messages));
	// La colonne est pilotée par la largeur en CSS : le serveur et le client
	// rendent les mêmes deux copies des sondages, et `xl:` décide laquelle
	// montre. Aucun déplacement du DOM après la première peinture, donc aucun
	// saut de mise en page à l'hydratation ni au redimensionnement.
	const hasRail = $derived(polls.length > 0);

	function dayLabel(key: string): string {
		if (key === data.today) return t('chat.today');
		if (key === data.yesterday) return t('chat.yesterday');
		return formatDateHeading(key);
	}

	/** Le jour est écrit une fois; les messages gardent leur heure. */
	const groups = $derived.by<DayGroup[]>(() => {
		const result: DayGroup[] = [];
		for (const message of messages) {
			const key = todayInZone(branding.timezone, message.createdAt);
			let group = result.at(-1);
			if (!group || group.key !== key) {
				group = { key, label: dayLabel(key), messages: [] };
				result.push(group);
			}
			group.messages.push(message);
		}
		return result;
	});

	// Une seule liste à plat, clé stable par message : quand une page plus
	// ancienne décale les frontières de jour, les lignes déjà rendues gardent
	// leur nœud DOM. Aucun conteneur de jour n'est recréé sous le lecteur, donc
	// aucun saut de mise en page pendant le préchargement de l'historique.
	const streamItems = $derived.by<StreamItem[]>(() => {
		const items: StreamItem[] = [];
		for (const group of groups) {
			const pollsOnly = group.messages.every((message) => message.poll && !message.deleted);
			items.push({ kind: 'day', key: `day:${group.key}`, label: group.label, pollsOnly });
			for (const message of group.messages) {
				items.push({ kind: 'message', key: message.id, message });
			}
		}
		return items;
	});

	// svelte-ignore state_referenced_locally
	let pillState = $state(initialPillState(messages));
	const newMessages = $derived(nextPillState(pillState, messages, false).newMessages);

	const NEAR_BOTTOM_PX = 160;

	function nearBottom(): boolean {
		const root = document.documentElement;
		return root.scrollHeight - window.scrollY - window.innerHeight < NEAR_BOTTOM_PX;
	}

	function scrollToLatest(immediate = false): void {
		window.scrollTo({
			top: document.documentElement.scrollHeight,
			behavior: immediate ? 'auto' : scrollBehavior(prefersReducedMotion())
		});
	}

	// Attend qu'une peinture ait eu lieu : la position initiale doit être posée
	// à l'écran avant que l'historique en arrière-plan n'ajoute des lignes.
	function nextPaint(): Promise<void> {
		return new Promise((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	}

	function newestCursor(): string | null {
		const latest = messages.at(-1);
		return latest ? encodeCursor(latest) : null;
	}

	function findMessageRow(messageId: string): HTMLElement | null {
		const row = document.querySelector<HTMLElement>(
			`[data-message-id="${CSS.escape(messageId)}"]`
		);
		// Une ligne masquée par la colonne (sondage en double copie) n'a pas de
		// boîte : elle ne peut servir ni d'ancre ni de cible de lecture.
		if (!row || row.getClientRects().length === 0) return null;
		return row;
	}

	/** Le premier message encore visible est l'ancre stable de la lecture. */
	function currentAnchor(): ChatPosition | null {
		for (const row of document.querySelectorAll<HTMLElement>('[data-message-id]')) {
			const rect = row.getBoundingClientRect();
			if (rect.bottom > 0) {
				const messageId = row.dataset.messageId;
				if (!messageId) continue;
				return { messageId, offset: rect.top, savedAt: clock.nowMs() };
			}
		}
		return null;
	}

	function scrollToAnchor(anchor: Pick<ChatPosition, 'messageId' | 'offset'>): boolean {
		const row = findMessageRow(anchor.messageId);
		if (!row) return false;
		const top = row.getBoundingClientRect().top + window.scrollY - anchor.offset;
		window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
		return true;
	}

	function startSaving(): void {
		saving = true;
	}

	/** En bas, la pastille s'acquitte sans attendre un clic. */
	function acknowledgeIfBottom(): void {
		if (!nearBottom()) return;
		const next = nextPillState(pillState, messages, true);
		if (next !== pillState) pillState = next;
	}

	function scheduleSave(): void {
		if (!saving || !viewerId) return;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			saveTimer = undefined;
			savePosition();
		}, 150);
	}

	function savePosition(): void {
		if (!saving || !viewerId) return;
		const anchor = currentAnchor();
		if (anchor) writeChatPosition(viewerId, anchor);
	}

	function flushSave(): void {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = undefined;
		}
		savePosition();
	}

	function isAbort(error: unknown): boolean {
		return error instanceof DOMException && error.name === 'AbortError';
	}

	async function hydrateCache(): Promise<void> {
		if (!viewerId) {
			hydrated = true;
			return;
		}
		const cached = await readChatCache(viewerId);
		if (abort.signal.aborted) return;
		const hadCache = Boolean(cached?.messages.length);
		if (cached?.messages.length) {
			messages = mergeChatMessages(cached.messages, messages);
			complete = cached.complete;
			// Un cache sans instant serveur est réconcilié depuis l'origine.
			syncedAt = cached.syncedAt ?? 0;
			const cachedLatest = decodeCursor(cached.latestCursor);
			const oldestServer = data.messages.at(-1);
			if (
				cachedLatest &&
				oldestServer &&
				compareChatMessages(cachedLatest, oldestServer) < 0
			) {
				// La page serveur commence après le dernier message connu :
				// les messages intermédiaires manquent aux deux copies.
				pendingGapCursor = cached.latestCursor;
			}
		}
		// Le curseur appartient à la fenêtre fusionnée, jamais au seul cache :
		// une page plus ancienne doit reprendre avant le plus vieux message
		// réellement détenu, sinon les messages intermédiaires seraient sautés.
		olderCursor = complete
			? null
			: messages.length > 0
				? encodeCursor(messages[0])
				: data.nextCursor;
		// Rien ne doit observer la sentinelle du rendu serveur : le cache doit
		// d'abord poser sa version du fil et son propre curseur.
		await tick();
		hydrated = true;
		// Une copie chaude n'a besoin que de la page fraîche du serveur; une
		// première ouverture écrit la page qui vient d'être rendue.
		const stored = await writeChatMessages(
			viewerId,
			hadCache ? data.messages : messages,
			{ complete, syncedAt }
		);
		cacheError = stored === null;
	}

	async function loadOlderPage(
		options: { preserveScroll: boolean } = { preserveScroll: true }
	): Promise<boolean> {
		if (!viewerId || !olderCursor || loadingOlder) return false;
		loadingOlder = true;
		olderError = false;
		// Une page plus ancienne s'ajoute au-dessus du lecteur : le message
		// qu'il regarde reste au même endroit, sans dépendre d'une hauteur
		// mesurée pendant que le cache pose encore sa version du fil.
		const anchor = options.preserveScroll ? currentAnchor() : null;
		try {
			const response = await fetch(
				`/api/discussion/messages?before=${encodeURIComponent(olderCursor)}`,
				{ signal: abort.signal, headers: { accept: 'application/json' } }
			);
			if (!response.ok) throw new Error(`chat older ${response.status}`);
			const payload = (await response.json()) as ChatPage;
			if (!Array.isArray(payload.messages)) throw new Error('chat older payload');
			if (abort.signal.aborted) return false;
			const incoming = [...payload.messages].reverse();
			messages = mergeChatMessages(messages, incoming);
			olderCursor = payload.nextCursor ?? null;
			complete = olderCursor === null;
			// La correction d'ancre suit le DOM dans la même frame : aucune
			// peinture ne doit montrer les lignes ajoutées sans compensation.
			// La persistance IndexedDB vient après, elle ne bloque pas le scroll.
			await tick();
			if (anchor) scrollToAnchor(anchor);
			const stored = await writeChatMessages(viewerId, incoming, {
				complete,
				syncedAt
			});
			cacheError = stored === null;
			return incoming.length > 0;
		} catch (error) {
			if (!isAbort(error)) olderError = true;
			return false;
		} finally {
			loadingOlder = false;
		}
	}

	/**
	 * Un fil vide n'a aucun curseur `after` : la page la plus récente du
	 * serveur est la seule façon de voir arriver le premier message. C'est le
	 * même contrat que le rendu initial, sans rechargement.
	 */
	async function refreshLatest(): Promise<void> {
		if (!viewerId) return;
		const response = await fetch('/api/discussion/messages', {
			signal: abort.signal,
			headers: { accept: 'application/json' }
		});
		if (!response.ok) throw new Error(`chat latest ${response.status}`);
		const payload = (await response.json()) as ChatPage;
		if (!Array.isArray(payload.messages)) throw new Error('chat latest payload');
		if (abort.signal.aborted || payload.messages.length === 0) return;
		const incoming = [...payload.messages].reverse();
		const newestBefore = messages.at(-1)?.id ?? null;
		const atBottom = nearBottom();
		messages = mergeChatMessages(messages, incoming);
		olderCursor = payload.nextCursor ?? null;
		complete = olderCursor === null;
		const stored = await writeChatMessages(viewerId, incoming, { complete, syncedAt });
		cacheError = stored === null;
		if (atBottom && messages.at(-1)?.id !== newestBefore) scrollToLatest();
	}

	async function resetLocalCopy(): Promise<void> {
		if (!viewerId) return;
		await clearChatCache(viewerId);
		window.location.reload();
	}

	async function sync(): Promise<void> {
		if (!viewerId) return;
		if (syncing) {
			syncQueued = true;
			return;
		}
		syncing = true;
		syncError = false;
		try {
			const after = newestCursor();
			if (!after) {
				await refreshLatest();
				return;
			}
			let cursor: string | null = after;
			let since = syncedAt;
			let pages = 0;
			while (cursor && pages < CHAT_SYNC_MAX_PAGES) {
				let query = `after=${encodeURIComponent(cursor)}`;
				if (since !== null) query += `&deletedSince=${since}`;
				const response = await fetch(`/api/discussion/messages?${query}`, {
					signal: abort.signal,
					headers: { accept: 'application/json' }
				});
				if (!response.ok) throw new Error(`chat sync ${response.status}`);
				const payload = (await response.json()) as ChatSyncPage;
				if (!Array.isArray(payload.messages)) throw new Error('chat sync payload');
				if (abort.signal.aborted) return;
				if (payload.reset === true) {
					// Le cache ne peut pas prouver qu'il a vu toutes les
					// suppressions : la seule copie sûre est celle du serveur.
					await resetLocalCopy();
					return;
				}
				const newestBefore = messages.at(-1)?.id ?? null;
				const atBottom = nearBottom();
				messages = applyPollStates(
					applyDeletedIds(
						mergeChatMessages(messages, payload.messages),
						Array.isArray(payload.deletedIds) ? payload.deletedIds : []
					),
					Array.isArray(payload.polls) ? payload.polls : []
				);
				since =
					typeof payload.now === 'number' && Number.isSafeInteger(payload.now)
						? payload.now
						: since;
				syncedAt = since;
				const touchedIds = new Set([
					...(Array.isArray(payload.deletedIds) ? payload.deletedIds : []),
					...(Array.isArray(payload.polls)
						? payload.polls.map((entry) => entry.id)
						: [])
				]);
				const touched = messages.filter((message) => touchedIds.has(message.id));
				const stored = await writeChatMessages(
					viewerId,
					[...payload.messages, ...touched],
					{ complete, syncedAt }
				);
				cacheError = stored === null;
				const newestAfter = messages.at(-1)?.id ?? null;
				if (atBottom && newestAfter !== newestBefore) scrollToLatest();
				cursor = payload.hasMore ? payload.nextAfter : null;
				pages++;
			}
			if (cursor) syncQueued = true;
		} catch (error) {
			if (!isAbort(error)) syncError = true;
		} finally {
			syncing = false;
			if (syncQueued && !abort.signal.aborted) {
				syncQueued = false;
				void sync();
			}
		}
	}

	/**
	 * Une copie plus ancienne que la page serveur laisse un trou : le cache
	 * s'arrête à `latestCursor`, la page serveur reprend plus loin. Le segment
	 * se comble par `after`, borné par le budget de lecture; au-delà, la copie
	 * locale repart du serveur plutôt que de garder un historique discontinu.
	 */
	async function bridgeCacheGap(since: string): Promise<void> {
		if (!viewerId) return;
		const oldestServer = data.messages.at(-1);
		const start = decodeCursor(since);
		if (!oldestServer || !start) return;
		if (compareChatMessages(start, oldestServer) >= 0) return;
		let cursor: string | null = since;
		let pages = 0;
		let bridged = false;
		try {
			while (cursor && pages < CHAT_SYNC_MAX_PAGES && !bridged) {
				const response = await fetch(
					`/api/discussion/messages?after=${encodeURIComponent(cursor)}`,
					{ signal: abort.signal, headers: { accept: 'application/json' } }
				);
				if (!response.ok) throw new Error(`chat gap ${response.status}`);
				const payload = (await response.json()) as ChatSyncPage;
				if (!Array.isArray(payload.messages)) throw new Error('chat gap payload');
				if (abort.signal.aborted) return;
				if (payload.reset === true) {
					await resetLocalCopy();
					return;
				}
				const anchor = currentAnchor();
				messages = mergeChatMessages(messages, payload.messages);
				const newestFetched = payload.messages.at(-1);
				bridged =
					!payload.hasMore ||
					!newestFetched ||
					compareChatMessages(newestFetched, oldestServer) >= 0;
				await tick();
				if (anchor) scrollToAnchor(anchor);
				const stored = await writeChatMessages(viewerId, payload.messages, {
					complete,
					syncedAt
				});
				cacheError = stored === null;
				cursor = payload.hasMore ? payload.nextAfter : null;
				pages++;
			}
			if (!bridged) await resetLocalCopy();
		} catch (error) {
			if (!isAbort(error)) {
				// La synchronisation normale reste disponible; le trou est
				// retenté à la prochaine ouverture.
				cacheError = true;
			}
		}
	}

	async function prefetchHistory(): Promise<void> {
		let pages = 0;
		while (olderCursor && !complete && pages < CHAT_HISTORY_PREFETCH_PAGES) {
			if (document.visibilityState === 'hidden' || abort.signal.aborted) break;
			const before = messages.length;
			const loaded = await loadOlderPage({ preserveScroll: true });
			pages++;
			if (!loaded || messages.length === before) break;
		}
	}

	/** Remplit la fenêtre quand le fil est plus court qu'elle. */
	async function fillViewport(): Promise<void> {
		let guard = 0;
		while (olderCursor && guard < 5 && !loadingOlder) {
			const node = sentinel;
			if (!node) break;
			if (node.getBoundingClientRect().top > window.innerHeight + 600) break;
			const before = messages.length;
			const loaded = await loadOlderPage({ preserveScroll: true });
			guard++;
			if (!loaded || messages.length === before) break;
			await tick();
		}
	}

	async function restoreReadingPosition(): Promise<boolean> {
		if (!viewerId || !savedPosition) return false;
		await document.fonts.ready;
		if (abort.signal.aborted) return false;
		let row = findMessageRow(savedPosition.messageId);
		let guard = 0;
		while (!row && olderCursor && guard < CHAT_POSITION_LOOKUP_PAGES) {
			const loaded = await loadOlderPage({ preserveScroll: false });
			if (!loaded) break;
			await tick();
			row = findMessageRow(savedPosition.messageId);
			guard++;
		}
		if (!row) {
			ready = true;
			return false;
		}
		scrollToAnchor(savedPosition);
		ready = true;
		return true;
	}

	$effect(() => {
		if (!saving) return;
		acknowledgeIfBottom();
	});

	$effect(() => {
		if (!settled) return;
		const node = sentinel;
		if (!node || !olderCursor || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void fillViewport();
			},
			{ rootMargin: '600px 0px 0px 0px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	});

	$effect(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') void sync();
		}, 15_000);
		return () => clearInterval(timer);
	});

	onMount(() => {
		// Une lecture enregistrée masque le fil maintenant, avant la peinture,
		// pour ne jamais montrer le mauvais endroit.
		if (savedPosition) ready = false;
		const onScroll = () => {
			acknowledgeIfBottom();
			scheduleSave();
		};
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') {
				flushSave();
				return;
			}
			void sync();
		};
		const onPageHide = () => flushSave();

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('pagehide', onPageHide);
		document.addEventListener('visibilitychange', onVisibility);

		let cancelled = false;
		void (async () => {
			await hydrateCache();
			if (cancelled) return;
			const restored = await restoreReadingPosition();
			if (cancelled) return;
			if (!restored && !data.before) {
				await document.fonts.ready;
				if (cancelled) return;
				// La première ouverture rejoint le dernier message sans animer
				// tout l'historique : aucune position intermédiaire n'est sauvée.
				if (messages.length > 0) scrollToLatest(true);
			}
			// La position initiale peint avant tout enrichissement : sinon les
			// premières pages plus anciennes défilent sous un rendu pas encore
			// posé et produisent un saut de mise en page à l'ouverture.
			await nextPaint();
			if (cancelled) return;
			settled = true;
			startSaving();
			const gap = pendingGapCursor;
			if (gap) void bridgeCacheGap(gap);
			void sync();
			void prefetchHistory();
		})();

		return () => {
			cancelled = true;
			abort.abort();
			if (saveTimer) clearTimeout(saveTimer);
			flushSave();
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('pagehide', onPageHide);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});

	function showNewMessages(): void {
		pillState = initialPillState(messages);
		scrollToLatest();
	}

	function onChatChanged(): void {
		void sync();
	}

	async function onSent(): Promise<void> {
		await sync();
		scrollToLatest();
	}

	function onPollCreated(): void {
		showPoll = false;
		void sync();
	}

	function addOption(): void {
		pollOptions = [...pollOptions, ''];
	}

	function removeOption(index: number): void {
		pollOptions = pollOptions.filter((_, current) => current !== index);
	}
</script>

<PageHeader title={t('chat.title')} meta={t('chat.subtitle')}>
	{#snippet actions()}
		{#if data.canCreatePoll}
			<button
				class="btn-secondary btn-sm"
				type="button"
				onclick={() => (showPoll = !showPoll)}
				aria-expanded={showPoll}
				aria-controls="poll-form"
			>
				{showPoll ? t('common.close') : t('chat.newPoll')}
			</button>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-5 space-y-4">
	<FormFeedback {form} />

	{#if showPoll}
		<div id="poll-form" class="max-w-2xl">
			<SectionCard title={t('chat.newPoll')}>
				<form
					method="POST"
					action="?/poll"
					use:progressiveForm={{ onSuccess: onPollCreated }}
					class="space-y-3"
				>
					<div>
						<label class="label" for="question">{t('chat.pollQuestion')}</label>
						<input
							class="input"
							id="question"
							name="question"
							required
							maxlength={data.limits.questionMax}
						/>
					</div>
					<fieldset class="space-y-2">
						<legend class="sr-only">{t('chat.pollOptions')}</legend>
						{#each pollOptions as option, index (index)}
							<div class="flex gap-2">
								<label class="sr-only" for="poll-option-{index}">
									{t('chat.optionNumber', { number: index + 1 })}
								</label>
								<input
									class="input"
									id="poll-option-{index}"
									name="options"
									placeholder={option || t('chat.pollOptions')}
									required={index < data.limits.pollMinOptions}
									maxlength={data.limits.optionMax}
									bind:value={pollOptions[index]}
								/>
								{#if pollOptions.length > data.limits.pollMinOptions}
									<button
										class="btn-ghost btn-sm w-11 p-0"
										type="button"
										onclick={() => removeOption(index)}
										aria-label={chatControlName({ kind: 'pollOption', index })}
									>
										×
									</button>
								{/if}
							</div>
						{/each}
					</fieldset>
					<div class="flex flex-wrap gap-2">
						<button
							class="btn-secondary btn-sm"
							type="button"
							onclick={addOption}
							disabled={!canAddOption}
						>
							{t('chat.addOption')}
						</button>
						<button class="btn-primary btn-sm" type="submit">{t('chat.publishPoll')}</button>
					</div>
				</form>
			</SectionCard>
		</div>
	{/if}

	<div class="mx-auto w-full max-w-4xl xl:max-w-6xl">
		<div class="grid gap-6 {hasRail ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : ''}">
			<div class="min-w-0 space-y-4">
				{#if hydrated && messages.length === 0 && EmptyState}
					<EmptyState title={t('chat.empty')} help={t('chat.emptyHelp')} />
				{:else if messages.length > 0}
					<div
						class="flex min-h-6 items-center justify-center {ready ? '' : 'invisible'}"
					>
						{#if loadingOlder}
							<p class="text-meta text-muted" role="status">{t('chat.loadingOlder')}</p>
						{:else if olderError}
							<div class="flex flex-wrap items-center justify-center gap-2">
								<p class="text-meta text-muted" role="status">
									{t('chat.olderUnavailable')}
								</p>
								<button
									class="btn-secondary btn-sm"
									type="button"
									onclick={() => void loadOlderPage()}
								>
									{t('chat.loadOlder')}
								</button>
							</div>
						{:else if olderCursor}
							<div
								bind:this={sentinel}
								data-chat-older-cursor
								class="h-1 w-full"
								aria-hidden="true"
							></div>
						{/if}
					</div>

					<section
						class="sheet {ready ? '' : 'invisible'}"
						aria-label={t('chat.title')}
					>
						<ul role="list">
							{#each streamItems as item (item.key)}
								{#if item.kind === 'day'}
									<li
										role="presentation"
										class="border-b border-line bg-paper-deep/60 px-4 py-2 text-caption font-semibold text-muted {item.pollsOnly
											? 'xl:hidden'
											: ''}"
									>
										{item.label}
									</li>
								{:else}
									{@const message = item.message}
									<li
										class="chat-row {message.poll && !message.deleted ? 'xl:hidden' : ''}"
										data-own={message.isOwn}
										data-message-id={message.id}
										data-poll={message.poll && !message.deleted ? 'true' : undefined}
									>
										<div class="chat-avatar">
											<Avatar
												player={{
													fullName: message.authorName,
													userId: message.authorUserId,
													avatarId: message.authorAvatarId
												}}
												size={44}
												decorative={false}
											/>
										</div>

										<div class="chat-meta">
											<span class="flex min-w-0 items-center gap-1.5">
												<span class="truncate text-body font-semibold"
													>{message.authorName}</span
												>
												{#if message.isOwn}
													<span class="badge shrink-0">{t('chat.you')}</span>
												{/if}
											</span>
											<span class="flex flex-wrap items-center gap-1.5">
												{#if message.authorJerseyNumber !== null}
													<span
														class="grid h-5 min-w-6 place-items-center rounded-[0.25rem] bg-ice-soft px-1 font-mono text-caption font-semibold text-ice-deep"
														role="img"
														aria-label={t('chat.jersey', {
															number: message.authorJerseyNumber
														})}
													>
														{message.authorJerseyNumber}
													</span>
												{/if}
												{#if message.authorPosition}
													<span class="text-caption text-muted">
														{t(
															positionDefinition(message.authorPosition)
																.shortLabelKey
														)}
													</span>
												{/if}
											</span>
											<time
												class="chat-time"
												datetime={toDate(message.createdAt).toISOString()}
											>
												{formatTimeOfDay(message.createdAt)}
											</time>
										</div>

										<div class="chat-body">
											{#if message.deleted}
												<p class="text-body italic text-muted">{t('chat.deleted')}</p>
											{:else if message.poll}
												<PollOptions
													messageId={message.id}
													poll={message.poll}
													onsuccess={onChatChanged}
												/>
											{:else}
												<p class="whitespace-pre-wrap break-words text-body">
													{message.body}
												</p>
											{/if}
										</div>

										{#if message.canDelete}
											<div class="absolute right-1 top-2">
												<ChatMessageActions
													{message}
													onsuccess={onChatChanged}
												/>
											</div>
										{/if}
									</li>
								{/if}
							{/each}
						</ul>
					</section>
				{/if}

				{#if syncError}
					<p class="text-center text-meta text-muted" role="status">
						{t('chat.connectionLost')}
					</p>
				{/if}
				{#if cacheError}
					<p class="text-center text-meta text-muted" role="status">
						{t('chat.cacheUnavailable')}
					</p>
				{/if}

				<ChatNewMessages count={newMessages} onshow={showNewMessages} />

				<form
					method="POST"
					action="?/send"
					use:progressiveForm={{ onSuccess: onSent }}
					aria-label={t('chat.writeTitle')}
					class="sticky bottom-[var(--bottom-bar-offset)] z-20 w-full lg:bottom-[calc(var(--footer-offset)+0.25rem)]"
					bind:clientHeight={composerHeight}
				>
					<label class="sr-only" for="chat-body">{t('chat.messageLabel')}</label>
					<div class="sheet flex items-end gap-2 p-2">
						<textarea
							id="chat-body"
							class="input min-h-11 min-w-0 flex-1 resize-none border-transparent bg-transparent"
							name="body"
							rows="1"
							placeholder={t('chat.placeholder')}
							required
							maxlength={data.limits.messageMax}
						></textarea>
						<button class="btn-primary" type="submit">{t('chat.send')}</button>
					</div>
				</form>
			</div>

			{#if hasRail}
				<aside class="hidden xl:block" aria-label={t('chat.pollsTitle')}>
					<div
						class="sticky top-[var(--anchor-offset)] max-h-[calc(100dvh-var(--anchor-offset)-var(--footer-offset)-1rem)] overflow-y-auto"
					>
						<SectionCard title={t('chat.pollsTitle')} clip={false}>
							<div class="space-y-4">
								{#each polls as entry (entry.message.id)}
									<div
										class="relative border-t border-line pt-4 first:border-0 first:pt-0 {entry.message
											.canDelete
											? 'pr-12'
											: ''}"
									>
										<PollOptions
											messageId={entry.message.id}
											poll={entry.poll}
											onsuccess={onChatChanged}
										/>
										{#if entry.message.canDelete}
											<div class="absolute right-0 top-0">
												<ChatMessageActions
													message={entry.message}
													onsuccess={onChatChanged}
												/>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</SectionCard>
					</div>
				</aside>
			{/if}
		</div>
	</div>
</div>
