<script lang="ts">
	import type { PageData } from './$types';
	import TournamentScreen from '#lib/TournamentScreen.svelte';

	let { data }: { data: PageData } = $props();
</script>

<TournamentScreen tournament={data.state} />
