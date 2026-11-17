<script lang="ts">
	import { t } from '#lib/shared/i18n/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
</script>

<PageHeader title={t('teams.title')} meta={t('teams.meta')} />

<EmptyState title={t('teams.noGames')} help={t('teams.noGamesHelp')} />
