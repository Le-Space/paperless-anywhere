<script>
	// How a person gets an image of their own (docs/own-image.md): four steps
	// with a small drawing each, and who knows the passphrase. All text comes
	// from the landing page's catalogue.
	let { t } = $props();
	const MARK = { yes: '✓', brief: '◔', no: '✕' };
</script>

<p class="status" data-testid="own-image-status">{t.status}</p>

<ol class="flow" data-testid="own-image-flow">
	{#each t.steps as s, i}
		<li>
			<svg viewBox="0 0 48 48" aria-hidden="true">
				{#if i === 0}
					<path d="M24 6 40 14v20L24 42 8 34V14z" />
					<path d="M8 14l16 8 16-8M24 22v20" />
				{:else if i === 1}
					<rect x="12" y="12" width="24" height="24" rx="4" />
					<path d="M18 6v6M24 6v6M30 6v6M18 36v6M24 36v6M30 36v6M6 18h6M6 24h6M6 30h6M36 18h6M36 24h6M36 30h6" />
					<path class="hi" d="m18.5 24.5 4 4 7.5-8.5" />
				{:else if i === 2}
					<path d="M24 6 40 14v20L24 42 8 34V14z" />
					<rect class="hi" x="17" y="23" width="14" height="10" rx="2" />
					<path class="hi" d="M20 23v-3a4 4 0 0 1 8 0v3" />
				{:else}
					<rect x="8" y="9" width="32" height="12" rx="3" />
					<rect x="8" y="27" width="32" height="12" rx="3" />
					<path d="M14 15h.01M14 33h.01" />
					<path class="hi" d="m27 12 6 3-6 3z" />
				{/if}
			</svg>
			<span class="n data">0{i + 1}</span>
			<h3>{s.t}</h3>
			<p>{s.d}</p>
		</li>
	{/each}
</ol>

<div class="knows">
	<h3>{t.knowsTitle}</h3>
	<ul data-testid="own-image-knows">
		{#each t.knows as k}
			<li class={k.v}>
				<span class="mark" aria-hidden="true">{MARK[k.v]}</span>
				<span><strong>{k.who}</strong><span class="sr">: {t.answers[k.v]}</span>{#if k.d}<br /><small>{k.d}</small>{/if}</span>
			</li>
		{/each}
	</ul>
	<p class="compare">{t.compare}</p>
</div>

<style>
	.status { display: inline-block; margin: 0.25rem 0 0; padding: 0.2rem 0.7rem; border-radius: 999px; background: var(--warn-bg); color: var(--warn); font-family: var(--mono); font-size: 0.8rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
	.flow { list-style: none; padding: 0; margin: 1.5rem 0 0; display: grid; gap: 1.75rem; grid-template-columns: repeat(4, 1fr); }
	.flow li { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem; box-shadow: var(--shadow); }
	/* The arrow to the next step: to the right in a row, downwards in a column. */
	.flow li:not(:last-child)::after { content: '→'; position: absolute; right: -1.4rem; top: 50%; transform: translateY(-50%); color: var(--accent-text); font-size: 1.1rem; }
	.flow svg { width: 44px; height: 44px; fill: none; stroke: var(--text); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
	.flow svg .hi { stroke: var(--accent); stroke-width: 2.5; }
	.flow h3 { margin: 0 0 0.4rem; }
	.flow p { margin: 0; color: var(--text-2); font-size: 0.95rem; }
	.n { color: var(--accent-text); font-weight: 500; display: block; margin: 0.5rem 0; }
	@media (max-width: 860px) {
		.flow { grid-template-columns: 1fr; }
		.flow li:not(:last-child)::after { content: '↓'; right: auto; left: 50%; top: auto; bottom: -1.55rem; transform: translateX(-50%); }
	}
	.knows { margin-top: 1.5rem; background: var(--surface-2); border-radius: var(--radius); padding: 1.25rem; }
	.knows h3 { margin: 0 0 0.75rem; }
	.knows ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.6rem 1.25rem; grid-template-columns: repeat(3, 1fr); }
	.knows li { display: flex; gap: 0.6rem; align-items: flex-start; }
	.mark { flex: none; width: 1.6rem; height: 1.6rem; border-radius: 50%; display: grid; place-items: center; font-size: 0.85rem; font-weight: 700; }
	.yes .mark { background: var(--ok-bg); color: var(--ok); }
	.brief .mark { background: var(--warn-bg); color: var(--warn); }
	.no .mark { background: var(--danger-bg); color: var(--danger); }
	small { color: var(--text-2); }
	.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.compare { margin: 1rem 0 0; color: var(--text-2); font-size: 0.95rem; }
	@media (max-width: 860px) {
		.knows ul { grid-template-columns: 1fr; }
	}
</style>
