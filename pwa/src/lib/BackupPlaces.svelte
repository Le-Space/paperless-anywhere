<script>
	import { listProviders, outsideEu, pickProviders, sharedWarnings, storagePrices, monthlyCost, bytesPerCopy } from '$lib/providers.js';
	import { amount } from '$lib/balances.js';

	/** @type {{ network: string, payer?: string, config: { copies: number, providerIds: number[], regions: string[] }, busy?: boolean, onsave: (places: { copies: number, providerIds: number[], regions: string[] }) => void }} */
	let { network, payer = '', config, busy = false, onsave } = $props();

	const REGIONS = [
		{ value: 'EUROPE', label: 'Europa (EWR, Großbritannien, Schweiz)' },
		{ value: 'EU', label: 'EU' },
		{ value: 'EEA', label: 'EWR' },
		{ value: 'US', label: 'USA' },
		{ value: '', label: 'überall' }
	];

	/** @type {import('$lib/providers.js').Provider[] | null} */
	let providers = $state(null);
	let readError = $state('');
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

	$effect(() => {
		const net = network;
		providers = null;
		readError = '';
		listProviders(net).then((list) => (providers = list)).catch(() => (readError = 'Die Anbieterliste ließ sich gerade nicht lesen.'));
		storagePrices(net).then((p) => (prices = p)).catch(() => (prices = null));
	});
	$effect(() => {
		if (payer) bytesPerCopy(network, payer).then((b) => (bytes = b)).catch(() => (bytes = 0));
	});

	const regions = $derived(
		region === 'custom' ? countries.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)) : region ? [region] : []
	);
	const places = $derived(mode === 'providers' ? { copies: chosen.length, providerIds: chosen, regions: [] } : { copies, providerIds: [], regions });
	const preview = $derived(providers ? pickProviders(providers, places) : null);
	const warnings = $derived(preview ? sharedWarnings(preview.picked) : []);
	const abroad = $derived(preview ? outsideEu(preview.picked) : []);
	const cost = $derived(prices && preview ? monthlyCost(prices, preview.picked.length, bytes) : null);
	const changed = $derived(JSON.stringify(places) !== JSON.stringify({ copies: config.copies, providerIds: config.providerIds ?? [], regions: config.regions ?? [] }));
	const valid = $derived(!!preview && !preview.problems.length && preview.picked.length >= 1 && (mode === 'region' || chosen.length <= 3));

	const toggle = (id, on) => (chosen = on ? [...chosen.filter((x) => x !== id), id] : chosen.filter((x) => x !== id));
</script>

<fieldset class="places" data-testid="backup-places">
	<legend>Wohin die Sicherungen gehen</legend>
	<label class="check"><input type="radio" bind:group={mode} value="region" /> Region und Anzahl der Kopien</label>
	<label class="check"><input type="radio" bind:group={mode} value="providers" /> Anbieter selbst wählen</label>

	{#if mode === 'region'}
		<label>Kopien
			<select bind:value={copies} data-testid="places-copies">
				{#each [1, 2, 3] as n (n)}<option value={n}>{n}</option>{/each}
			</select>
		</label>
		<label>Region
			<select bind:value={region} data-testid="places-region">
				{#each REGIONS as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
				<option value="custom">Länder (Kürzel)</option>
			</select>
		</label>
		{#if region === 'custom'}<label>Länderkürzel, z. B. DE, NL<input bind:value={countries} placeholder="DE, NL" data-testid="places-countries" /></label>{/if}
	{:else if providers}
		<ul class="providers">
			{#each providers as p (p.id)}
				<li>
					<label class="check">
						<input type="checkbox" checked={chosen.includes(p.id)} disabled={!p.active || (!chosen.includes(p.id) && chosen.length >= 3)}
							onchange={(e) => toggle(p.id, e.currentTarget.checked)} data-testid={`provider-${p.id}`} />
						<span>{p.place || 'ohne Ort'} · {p.name} <small>({p.endorsed ? 'empfohlen' : 'zugelassen'}{p.active ? '' : ', nicht aktiv'}, Nr. {p.id})</small></span>
					</label>
				</li>
			{/each}
		</ul>
		<small class="hint">Höchstens 3 Anbieter.</small>
	{/if}

	{#if readError}<p class="hint">{readError}</p>
	{:else if !providers}<p class="hint">Lese die Anbieter …</p>
	{:else if preview}
		<div class="preview" data-testid="places-preview">
			{#if preview.picked.length}
				<p>Kopien bei:</p>
				<ul>{#each preview.picked as p (p.id)}<li>{p.place || 'ohne Ort'} · {p.name}</li>{/each}</ul>
			{/if}
			{#each preview.problems as problem}<p class="error">{problem}</p>{/each}
			{#each warnings as w}<p class="warn" data-testid="places-warning">Nicht unabhängig: {w}</p>{/each}
			{#if abroad.length}
				<p class="warn" data-testid="places-outside-eu">Kopien außerhalb der EU ({abroad.join(', ')}). Elektronische Bücher und Aufzeichnungen erlaubt die Abgabenordnung ohne Antrag nur in EU-Mitgliedstaaten (§ 146 Abs. 2a AO); außerhalb braucht es eine Bewilligung des Finanzamts (§ 146 Abs. 2b AO). Für steuerlich relevante Belege mit dem Steuerberater klären.</p>
			{/if}
			{#if cost !== null && preview.picked.length}<p><small>Kosten ca. {amount(cost)} USDFC im Monat{bytes ? ` bei ${amount(bytes / 1e9, 1)} GB je Kopie` : ' (Grundgebühr, noch keine Daten)'}.</small></p>{/if}
		</div>
	{/if}
	<button onclick={() => onsave($state.snapshot(places))} disabled={busy || !valid || !changed}>Sicherungsorte speichern</button>
</fieldset>

<style>
	.places { margin: 0.75rem 0; border: 1px solid #ddd; padding: 0.5rem 0.75rem; }
	.providers { list-style: none; padding: 0; margin: 0.25rem 0; }
	label { display: block; margin-top: 0.4rem; font-size: 0.9rem; color: #444; }
	label.check { display: flex; gap: 0.5rem; align-items: baseline; color: #000; font-size: 1rem; }
	label.check input { width: auto; }
	select, input:not([type]) { width: 100%; font-size: 1rem; }
	.preview ul { margin: 0.25rem 0; }
	.hint { color: #666; font-size: 0.9rem; }
	.warn { color: #b26a00; }
	.error { color: #b00020; }
	button { display: block; margin: 0.5rem 0; padding: 0.5rem 1rem; font-size: 1rem; }
</style>
