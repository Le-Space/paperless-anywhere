<script>
	import { independentCandidate, listProviders, oneOperator, outsideEu, pickProviders, sharedWarnings, storagePrices, monthlyCost, bytesPerCopy } from '$lib/providers.js';
	import { amount } from '$lib/balances.js';
	import { lang, t } from '$lib/i18n/index.js';

	/** @type {{ network: string, payer?: string, config: { copies: number, providerIds: number[], regions: string[], incremental?: { enabled?: boolean } }, busy?: boolean, onsave: (places: { copies: number, providerIds: number[], regions: string[], incremental: { enabled: boolean } }) => void }} */
	let { network, payer = '', config, busy = false, onsave } = $props();

	const x = $derived($t.backup.places);
	/** @type {{ value: string, key: 'EUROPE' | 'EU' | 'EEA' | 'US' | 'anywhere' }[]} */
	const REGIONS = [
		{ value: 'EUROPE', key: 'EUROPE' },
		{ value: 'EU', key: 'EU' },
		{ value: 'EEA', key: 'EEA' },
		{ value: 'US', key: 'US' },
		{ value: '', key: 'anywhere' }
	];

	/** @type {import('$lib/providers.js').Provider[] | null} */
	let providers = $state(null);
	let readError = $state(false);
	/** @type {{ perTibMonth: number, perDataSetMonth: number } | null} */
	let prices = $state(null);
	let bytes = $state(0);

	// The form starts from what is stored.
	let mode = $state(config.providerIds?.length ? 'providers' : 'region');
	let copies = $state(config.copies ?? 2);
	const storedRegion = config.regions?.length === 1 && REGIONS.some((r) => r.value === config.regions[0]) ? config.regions[0] : config.regions?.length ? 'custom' : '';
	let region = $state(storedRegion);
	let countries = $state(storedRegion === 'custom' ? config.regions.join(', ') : '');
	/** @type {number[]} */
	let chosen = $state([...(config.providerIds ?? [])]);
	// Incremental backups (snapshots): saved with the places, so saving them never drops it.
	let incremental = $state(config.incremental?.enabled === true);

	$effect(() => {
		const net = network;
		providers = null;
		readError = false;
		listProviders(net).then((list) => (providers = list)).catch(() => (readError = true));
		storagePrices(net).then((p) => (prices = p)).catch(() => (prices = null));
	});
	$effect(() => {
		if (payer) bytesPerCopy(network, payer).then((b) => (bytes = b)).catch(() => (bytes = 0));
	});

	const regions = $derived(
		region === 'custom' ? countries.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)) : region ? [region] : []
	);
	const places = $derived({ ...(mode === 'providers' ? { copies: chosen.length, providerIds: chosen, regions: [] } : { copies, providerIds: [], regions }), incremental: { enabled: incremental } });
	// Problems and warnings are sentences: read again when the language changes.
	const preview = $derived(($lang, providers ? pickProviders(providers, places) : null));
	const warnings = $derived(($lang, preview ? sharedWarnings(preview.picked) : []));
	const abroad = $derived(preview ? outsideEu(preview.picked) : []);
	const cost = $derived(prices && preview ? monthlyCost(prices, preview.picked.length, bytes) : null);
	const changed = $derived(JSON.stringify(places) !== JSON.stringify({ copies: config.copies, providerIds: config.providerIds ?? [], regions: config.regions ?? [], incremental: { enabled: config.incremental?.enabled === true } }));
	const valid = $derived(!!preview && !preview.problems.length && preview.picked.length >= 1 && (mode === 'region' || chosen.length <= 3));

	// A provider whose operator already holds a chosen copy: not offered (two copies there fail together).
	const twinOf = (/** @type {import('$lib/providers.js').Provider} */ p) => (chosen.includes(p.id) ? null : (providers ?? []).find((q) => chosen.includes(q.id) && oneOperator(q, p)) ?? null);
	// One more copy at an operator that holds none yet, while fewer than three.
	// The picked copies one per operator: a copy at an operator that holds one already does not count.
	const independent = $derived(preview ? preview.picked.filter((p, i) => !preview.picked.slice(0, i).some((q) => oneOperator(q, p))) : []);
	const third = $derived(preview && !preview.problems.length && independent.length >= 1 && independent.length < 3 && providers ? independentCandidate(providers, independent, mode === 'region' ? regions : []) : null);
	const addThird = () => {
		if (!third) return;
		chosen = [...independent.map((p) => p.id), third.provider.id];
		mode = 'providers';
	};
	const toggle = (id, on) => (chosen = on ? [...chosen.filter((x) => x !== id), id] : chosen.filter((x) => x !== id));
</script>

<fieldset class="places" data-testid="backup-places">
	<legend>{x.legend}</legend>
	<label class="check"><input type="radio" bind:group={mode} value="region" /> {x.byRegion}</label>
	<label class="check"><input type="radio" bind:group={mode} value="providers" /> {x.byProvider}</label>

	{#if mode === 'region'}
		<label>{x.copies}
			<select bind:value={copies} data-testid="places-copies">
				{#each [1, 2, 3] as n (n)}<option value={n}>{n}</option>{/each}
			</select>
		</label>
		<label>{x.region}
			<select bind:value={region} data-testid="places-region">
				{#each REGIONS as r (r.value)}<option value={r.value}>{x.regions[r.key]}</option>{/each}
				<option value="custom">{x.countries}</option>
			</select>
		</label>
		{#if region === 'custom'}<label>{x.countryCodes}<input bind:value={countries} placeholder="DE, NL" data-testid="places-countries" /></label>{/if}
	{:else if providers}
		<ul class="providers">
			{#each providers as p (p.id)}
				<li>
					<label class="check">
						<input type="checkbox" checked={chosen.includes(p.id)} disabled={!p.active || (!chosen.includes(p.id) && (Boolean(p.blocked) || chosen.length >= 3))}
							onchange={(e) => toggle(p.id, e.currentTarget.checked)} data-testid={`provider-${p.id}`} />
						<span>{p.place || x.noPlace} · {p.name} <small>({p.endorsed ? x.endorsed : x.approved}{p.active ? '' : x.inactive}, {x.number(p.id)}{#if p.blocked}, <span class="warn" data-testid={`provider-blocked-${p.id}`} title={x.blockedWhy[p.blocked]}>{x.blockedTag}: {x.blockedWhy[p.blocked]}</span>{/if})</small></span>
					</label>
				</li>
			{/each}
		</ul>
		<small class="hint">{x.max}</small>
	{/if}

	{#if readError}<p class="hint">{x.listUnreadable}</p>
	{:else if !providers}<p class="hint">{x.reading}</p>
	{:else if preview}
		<div class="preview" data-testid="places-preview">
			{#if preview.picked.length}
				<p>{x.copiesAt}</p>
				<ul>{#each preview.picked as p (p.id)}<li>{p.place || x.noPlace} · {p.name}</li>{/each}</ul>
			{/if}
			{#each preview.problems as problem}<p class="error">{problem}</p>{/each}
			{#each warnings as w}<p class="warn" data-testid="places-warning">{x.notIndependent(w)}</p>{/each}
			{#if abroad.length}
				<p class="warn" data-testid="places-outside-eu">{x.outsideEu(abroad.join(', '))}</p>
			{/if}
			{#if mode === 'region' && preview.picked.length && preview.operators !== undefined && preview.operators < copies}<p class="warn" data-testid="places-few-operators">{x.fewOperators(copies, preview.operators)}</p>{/if}
			{#if third}
				<div class="third" data-testid="places-third">
					<p>{x.third.offer(`${third.provider.name} (${x.number(third.provider.id)})`, third.provider.place)}{third.inRegion ? '' : ` ${x.third.outside}`}</p>
					<button type="button" onclick={addThird} disabled={busy} data-testid="places-add-third">{x.third.add}</button>
				</div>
			{/if}
			{#if cost !== null && preview.picked.length}<p><small>{x.cost(amount(cost, 2, $lang), bytes ? amount(bytes / 1e9, 1, $lang) : null)}</small></p>{/if}
		</div>
	{/if}
	<label class="check"><input type="checkbox" bind:checked={incremental} disabled={busy} data-testid="places-incremental" /> {x.incremental}</label>
	<p class="hint">{x.incrementalHint}</p>
	<button onclick={() => onsave($state.snapshot(places))} disabled={busy || !valid || !changed}>{x.save}</button>
</fieldset>

<style>
	.places { margin: 0.75rem 0; border: 1px solid var(--line); padding: 0.5rem 0.75rem; }
	.providers { list-style: none; padding: 0; margin: 0.25rem 0; }
	label { display: block; margin-top: 0.4rem; font-size: 0.9rem; color: var(--text-2); }
	label.check { display: flex; gap: 0.5rem; align-items: baseline; color: var(--text); font-size: 1rem; }
	label.check input { width: auto; }
	select, input:not([type]) { width: 100%; font-size: 1rem; }
	.preview ul { margin: 0.25rem 0; }
	.hint { color: var(--text-2); font-size: 0.9rem; }
	.warn { color: var(--warn); }
	.error { color: var(--danger); }
	button { display: block; margin: 0.5rem 0; padding: 0.5rem 1rem; font-size: 1rem; }
</style>
