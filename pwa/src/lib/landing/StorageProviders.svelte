<script>
	// The approved Filecoin storage providers by country, live from mainnet, as
	// the app's backup settings (BackupPlaces) read them.
	import { onMount } from 'svelte';

	let { t, lang } = $props();

	/** @type {import('../providers.js').Provider[]} */
	let providers = $state([]);
	let status = $state('loading');

	const countryName = $derived.by(() => {
		try {
			const names = new Intl.DisplayNames([lang], { type: 'region' });
			return (/** @type {string} */ code) => names.of(code) ?? code;
		} catch {
			return (/** @type {string} */ code) => code;
		}
	});
	const byCountry = $derived.by(() => {
		/** @type {Map<string, typeof providers>} */
		const groups = new Map();
		for (const p of providers.filter((p) => p.active)) {
			const c = p.country ?? '??';
			groups.set(c, [...(groups.get(c) ?? []), p]);
		}
		return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
	});
	const activeCount = $derived(providers.filter((p) => p.active).length);

	onMount(() => {
		// Loaded on demand: viem and the Filecoin contracts are not needed above the fold.
		import('../providers.js')
			.then(({ listProviders }) => listProviders('mainnet'))
			.then((list) => {
				providers = list;
				status = 'ok';
			})
			.catch(() => (status = 'error'));
	});
</script>

<div class="providers">
	{#if status === 'loading'}<p class="muted">{t.loading}</p>
	{:else if status === 'error'}<p class="muted">{t.error}</p>
	{:else}
		<p><strong>{t.count(activeCount, byCountry.length)}</strong></p>
		<ul class="countries">
			{#each byCountry as [code, list] (code)}
				<li>
					<span class="code data">{code}</span>
					<span class="country">{code === '??' ? '–' : countryName(code)}</span>
					<span class="names">
						{#each list as p (p.id)}<span class="sp">{p.name}{#if p.endorsed}<em>{t.endorsed}</em>{/if}</span>{/each}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="source">{t.source}</p>
</div>

<style>
	.muted, .source { color: var(--text-2); }
	.source { font-size: 0.8rem; margin: 0.5rem 0 0; }
	.countries { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
	.countries li { display: grid; grid-template-columns: 2.5rem 9rem 1fr; gap: 0.75rem; align-items: baseline; padding: 0.6rem 0.8rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); }
	.code { font-weight: 500; color: var(--accent-text); }
	.country { font-weight: 600; }
	.names { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.sp { font-size: 0.85rem; padding: 0.1rem 0.55rem; border-radius: 999px; background: var(--surface-2); overflow-wrap: anywhere; }
	.sp em { font-style: normal; font-size: 0.7rem; margin-left: 0.35rem; color: var(--ok); }
	@media (max-width: 560px) {
		.countries li { grid-template-columns: 2.5rem 1fr; }
		.names { grid-column: 1 / -1; }
	}
</style>
