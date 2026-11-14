<script lang="ts">
	let { href, compact = false }: { href: string; compact?: boolean } = $props();

	let text = $state<string | null>(null);
	let status = $state<'idle' | 'copied' | 'error'>('idle');
	let timer: ReturnType<typeof setTimeout> | null = null;

	// Précharge le texte pour que la copie reste dans le geste utilisateur.
	$effect(() => {
		let cancelled = false;
		fetch(href, { headers: { accept: 'text/plain' } })
			.then((response) => (response.ok ? response.text() : Promise.reject(new Error('share'))))
			.then((value) => {
				if (!cancelled) text = value;
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => () => {
		if (timer) clearTimeout(timer);
	});

	function announce(next: 'copied' | 'error') {
		status = next;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			status = 'idle';
			timer = null;
		}, 3000);
	}

	function legacyCopy(value: string) {
		const area = document.createElement('textarea');
		area.value = value;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		const copied = document.execCommand('copy');
		area.remove();
		if (!copied) throw new Error('copy');
	}

	async function copy() {
		try {
			let value = text;
			if (value === null) {
				const response = await fetch(href, { headers: { accept: 'text/plain' } });
				if (!response.ok) throw new Error('share');
				value = await response.text();
				text = value;
			}
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(value);
			} else {
				legacyCopy(value);
			}
			announce('copied');
		} catch {
			announce('error');
		}
	}
</script>

<button
	class="btn btn-sm"
	type="button"
	onclick={copy}
	title={compact ? 'Copier une synthèse des résultats' : undefined}
>
	{status === 'copied'
		? 'Copié !'
		: status === 'error'
			? 'Copie impossible'
			: compact
				? 'Export'
				: 'Copier les résultats'}
</button>
<span class="visually-hidden" role="status" aria-live="polite">
	{status === 'copied' ? 'Texte copié dans le presse-papiers.' : status === 'error' ? 'Copie impossible.' : ''}
</span>
