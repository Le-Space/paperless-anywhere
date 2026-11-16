<script>
	// What the Filecoin chain says about each copy of a backup (backup-chain.js):
	// read by the app itself, from the contracts, when the backup is shown and
	// again on "Jetzt prüfen". Green only for what the app read from the chain;
	// the sample from the provider is blue (reported), as in the start panel.
	// The lights are for the eye; every fact is written out with its state.
	import { checkBackupOnChain, sampleFetch } from '$lib/backup-chain.js';
	import { untrack } from 'svelte';
	import { format, lang, t } from '$lib/i18n/index.js';

	/** @type {{ network: string, backup: { pieceCid: string, copies: Array<{ providerId: string, retrievalUrl?: string, dataSetId?: string, pieceIds?: string[], place?: string }> } }} */
	let { network, backup } = $props();

	const x = $derived($t.backup.chain);
	const SIGN = { off: '·', run: '▶', app: '✓', reported: '•', failed: '✗' };
	const named = $derived(backup.copies.filter((c) => c.dataSetId != null));
	const key = $derived(`${network}:${backup.pieceCid}:${named.map((c) => c.dataSetId).join(',')}`);

	/** @type {Awaited<ReturnType<typeof checkBackupOnChain>> | null} */
	let copies = $state(null);
	/** @type {Record<string, Awaited<ReturnType<typeof sampleFetch>>>} */
	let samples = $state({});
	let busy = $state(false);
	let readAt = $state(0);
	let run = 0;

	async function check(/** @type {boolean} */ sample) {
		const mine = ++run;
		busy = true;
		const list = named;
		const [read, fetched] = await Promise.all([
			checkBackupOnChain({ network, copies: list }),
			sample ? Promise.all(list.map((c) => sampleFetch(String(c.retrievalUrl ?? '')))) : Promise.resolve(null)
		]);
		if (mine !== run) return;
		copies = read;
		if (fetched) samples = Object.fromEntries(list.map((c, i) => [String(c.dataSetId), fetched[i]]));
		readAt = Date.now();
		busy = false;
	}
	// Read when the backup is shown or changes; the provider is asked only on the button.
	$effect(() => {
		key;
		samples = {};
		copies = null;
		if (named.length) untrack(() => check(false));
	});

	const when = (/** @type {number | undefined} */ at) => (at ? format.dateTime(at, { dateStyle: 'medium', timeStyle: 'short' }, $lang) : '');
	/** A light's words. @param {any} l */
	function say(l) {
		const f = /** @type {any} */ (x.notes)[l.id]?.[l.note];
		if (typeof f !== 'function') return f ?? '';
		if (l.id === 'dataSet') return l.note === 'ending' ? f(when(l.at)) : l.note === 'live' ? f(l.count) : f(l.count, l.of);
		if (l.id === 'lastProof' || l.id === 'nextChallenge') return f(when(l.at), l.epoch);
		if (l.id === 'faults') return l.note === 'none' ? f(l.of) : f(l.count, l.of);
		if (l.id === 'paid') return l.note === 'until' ? f(when(l.at), l.count) : f(when(l.at));
		if (l.id === 'sample') return l.note === 'answers' ? f(l.bytes) : f(l.status);
		return '';
	}
	const lightsOf = (/** @type {any} */ copy) => {
		const s = samples[copy.dataSetId];
		return s ? [...copy.lights, { id: 'sample', ...s }] : copy.lights;
	};
	const overall = $derived(copies ? (copies.some((c) => c.state === 'failed') ? 'failed' : copies.every((c) => c.state === 'app') ? 'app' : 'off') : busy ? 'run' : 'off');
</script>

<details class="chain" data-testid="backup-chain" data-state={overall}>
	<summary>
		<span class="leds" aria-hidden="true">{#each copies ?? named as c, i (i)}<i class="led {copies ? /** @type {any} */ (c).state : busy ? 'run' : 'off'}"></i>{/each}</span>
		{x.title}{#if copies}<span class="sr">: {x.copyState[/** @type {'app' | 'failed' | 'off'} */ (overall)] ?? ''}</span>{/if}
	</summary>
	<p class="intro">{x.intro}</p>
	{#if !named.length}<p class="intro" data-testid="backup-chain-none">{x.noDataSets}</p>
	{:else}
		{#each copies ?? [] as copy (copy.dataSetId)}
			<section class="copy is-{copy.state}" data-testid="chain-copy-{copy.dataSetId}" data-state={copy.state}>
				<p class="name">{x.copy(copy.providerId, copy.place, copy.dataSetId)} <span class="state">({x.copyState[copy.state]})</span></p>
				{#if copy.error}<p class="err">{x.unreadable(copy.error)}</p>{/if}
				<ul class="facts">
					{#each lightsOf(copy) as l (l.id)}
						<li class={l.state} data-testid="chain-{l.id}" data-state={l.state}>
							<span class="sign" aria-hidden="true">{SIGN[/** @type {keyof typeof SIGN} */ (l.state)]}</span><strong>{/** @type {any} */ (x.lights)[l.id]}:</strong> {say(l)} <span class="state">({/** @type {any} */ (x.states)[l.state]})</span>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
		<p class="row">
			<button class="small" onclick={() => check(true)} disabled={busy} data-testid="chain-check">{x.check}</button>
			<span class="dim" role="status">{busy ? x.checking : readAt && copies?.[0]?.epoch ? x.checkedAt(when(readAt), copies[0].epoch) : ''}</span>
		</p>
	{/if}
	<p class="legend">{x.legend}</p>
</details>

<style>
	/* The colours of the start panel (StartPanel.svelte): green is the app's own check, blue what was reported. */
	.chain {
		--ground: #0b1020; --rule: #1f2947; --ink: #e6ebf8; --dim: #9aa6c6;
		--app: #5fd6a8; --rep: #8ab8f5; --run: #f5b041; --bad: #ff8a80; --off: #2a3558;
		margin: 0.75rem 0; padding: 0.6rem 0.9rem; border-radius: var(--radius); color: var(--ink); background: var(--ground); font-size: 0.85rem; text-align: left;
	}
	summary { cursor: pointer; font-family: var(--mono); font-weight: 600; display: flex; align-items: center; gap: 0.6rem; }
	.leds { display: inline-flex; gap: 0.35rem; }
	.led { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--off); }
	.led.app { background: var(--app); box-shadow: 0 0 6px var(--app); }
	.led.failed { background: var(--bad); box-shadow: 0 0 6px var(--bad); }
	.led.run { background: var(--run); box-shadow: 0 0 6px var(--run); }
	@media (prefers-reduced-motion: no-preference) {
		.led.run { animation: blink 1.2s ease-in-out infinite; }
		@keyframes blink { 50% { opacity: 0.25; } }
	}
	.intro, .legend, .dim, .state { color: var(--dim); }
	.intro { margin: 0.5rem 0; }
	.copy { padding: 0.5rem 0; border-top: 1px solid var(--rule); }
	.name { margin: 0 0 0.25rem; font-weight: 600; overflow-wrap: anywhere; }
	ul { list-style: none; margin: 0; padding: 0; }
	.facts li { padding: 0.05rem 0; overflow-wrap: anywhere; }
	.facts li.off { color: var(--dim); }
	.sign { display: inline-block; width: 1.1rem; font-weight: 700; }
	.app .sign { color: var(--app); }
	.reported .sign { color: var(--rep); }
	.failed .sign, .failed .state, .err { color: var(--bad); }
	.err { margin: 0.25rem 0; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.75rem; margin: 0.5rem 0 0; }
	.legend { margin: 0.6rem 0 0; padding-top: 0.6rem; border-top: 1px solid var(--rule); font-size: 0.8rem; }
	.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
