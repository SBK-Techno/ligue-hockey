<script lang="ts">
	import { identitySheetStyle } from './identity-display.ts';

	let { avatarId }: { avatarId: string } = $props();

	const style = $derived(identitySheetStyle(avatarId));
</script>

<!-- Le portrait est décoratif : le bouton, la fiche ou le jeton qui le porte
     fournit déjà le nom accessible. -->
<span class="identity-portrait" style={style} aria-hidden="true"></span>
