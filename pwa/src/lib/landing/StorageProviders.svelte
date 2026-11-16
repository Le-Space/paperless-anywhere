<script>
	// The approved Filecoin storage providers by country, live from mainnet, as
	// the app's backup settings (BackupPlaces) read them.
	import { onMount } from 'svelte';

	// Providers the registry still lists as active but Le Space does not use
	// for backups at the moment, because they have not answered since
	// 2026-11-16 (Strasbourg and Warsaw). Taken back in here once they serve
	// again. Only the landing page's list; the app checks reachability itself.
	const PAUSED = new Set([36, 37]);

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
	const shown = $derived(providers.filter((p) => p.active && !PAUSED.has(p.id)));
	const byCountry = $derived.by(() => {
		/** @type {Map<string, typeof providers>} */
		const groups = new Map();
		for (const p of shown) {
			const c = p.country ?? '??';
			groups.set(c, [...(groups.get(c) ?? []), p]);
		}
		return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
	});
	const activeCount = $derived(shown.length);

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
</div>

<style>
	.muted { color: var(--text-2); }
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
