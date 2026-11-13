<script>
	// The start of a VM as a panel of lights (start-panel.js): one row per
	// step, one light per fact. The lights are decoration for the eye only;
	// every fact is also written out with its state in words, and one polite
	// line says the row under way. Nothing blinks under reduced motion. No
	// image, font or script from anywhere: CSS only.
	import { currentRow } from '$lib/start-panel.js';

	/** @type {{ rows: import('$lib/start-panel.js').PanelRow[], t: typeof import('$lib/evidence-i18n.js').panelTexts.de }} */
	let { rows, t } = $props();
	const SIGN = { off: '·', run: '▶', app: '✓', reported: '•', skipped: '–', failed: '✗' };
	const cur = $derived(currentRow(rows));
</script>

<section class="panel" aria-label={t.title} data-testid="start-panel">
	<ol>
		{#each rows as row, i (row.id)}
			<li class="row is-{row.state}" data-testid="panel-{row.id}" data-state={row.state}>
				<span class="name"><span class="no" aria-hidden="true">{i + 1}</span>{t.rows[row.id]}<span class="sr">: {t.rowStates[row.state]}</span></span>
				<span class="leds" aria-hidden="true">{#each row.lights as l (l.id)}<i class="led {l.state}"></i>{/each}</span>
				<ul class="facts">
					{#each row.lights as l (l.id)}
						<li class={l.state} data-testid="light-{l.id}" data-state={l.state}><span class="sign" aria-hidden="true">{SIGN[l.state]}</span>{t.lights[l.id]} <span class="state">({t.states[l.state]})</span></li>
					{/each}
				</ul>
			</li>
		{/each}
	</ol>
	<p class="sr" role="status" aria-live="polite" data-testid="panel-live">{cur ? t.live(t.rows[cur.id], t.rowStates[cur.state]) : ''}</p>
	<p class="legend">{t.legend} {t.after}</p>
</section>

<style>
	/* A fixed dark panel in both themes: its own colours, each at least 4.5:1 on the ground. */
	.panel {
		--ground: #0b1020; --rule: #1f2947; --ink: #e6ebf8; --dim: #9aa6c6;
		--app: #5fd6a8; --rep: #8ab8f5; --run: #f5b041; --bad: #ff8a80; --off: #2a3558;
		margin: 1rem 0; padding: 0.9rem 1rem; border-radius: var(--radius); color: var(--ink); text-align: left;
		background-color: var(--ground);
		background-image: radial-gradient(1px 1px at 12% 18%, #ffffff66 50%, transparent 51%), radial-gradient(1px 1px at 71% 9%, #ffffff55 50%, transparent 51%), radial-gradient(1px 1px at 88% 62%, #ffffff44 50%, transparent 51%), radial-gradient(1px 1px at 34% 83%, #ffffff44 50%, transparent 51%), radial-gradient(1px 1px at 55% 41%, #ffffff33 50%, transparent 51%);
		font-size: 0.85rem;
	}
	ol, ul { list-style: none; margin: 0; padding: 0; }
	.row { display: grid; grid-template-columns: 9.5rem 5rem minmax(0, 1fr); gap: 0.25rem 0.75rem; align-items: start; padding: 0.5rem 0; border-top: 1px solid var(--rule); }
	.row:first-child { border-top: 0; }
	.name { font-family: var(--mono); font-weight: 600; }
	.no { display: inline-block; width: 1.3rem; color: var(--dim); }
	.is-off .name { color: var(--dim); }
	.leds { display: flex; gap: 0.4rem; padding-top: 0.3rem; }
	.led { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--off); }
	.led.app { background: var(--app); box-shadow: 0 0 6px var(--app); }
	.led.reported { background: var(--rep); box-shadow: 0 0 6px var(--rep); }
	.led.run { background: var(--run); box-shadow: 0 0 6px var(--run); }
	.led.failed { background: var(--bad); box-shadow: 0 0 6px var(--bad); }
	.led.skipped { background: transparent; border: 2px solid var(--dim); }
	@media (prefers-reduced-motion: no-preference) {
		.led.run { animation: blink 1.2s ease-in-out infinite; }
		@keyframes blink { 50% { opacity: 0.25; } }
	}
	.facts li { color: var(--dim); padding: 0.05rem 0; overflow-wrap: anywhere; }
	.facts li.app, .facts li.reported, .facts li.run, .facts li.failed { color: var(--ink); }
	.sign { display: inline-block; width: 1.1rem; font-weight: 700; }
	.app .sign { color: var(--app); }
	.reported .sign { color: var(--rep); }
	.run .sign { color: var(--run); }
	.failed .sign, .failed .state { color: var(--bad); }
	.state { color: var(--dim); }
	.legend { margin: 0.6rem 0 0; padding-top: 0.6rem; border-top: 1px solid var(--rule); color: var(--dim); font-size: 0.8rem; }
	.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	@media (max-width: 560px) {
		.row { grid-template-columns: minmax(0, 1fr) auto; }
		.facts { grid-column: 1 / -1; }
	}
</style>
