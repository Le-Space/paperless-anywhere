<script>
	// "Nachprüfbar": where the image is built, how it is encrypted, who knows
	// which secret, what the attestation confirms and what not yet, and where
	// each claim can be checked. Written from docs/security-model.md,
	// docs/keys-and-recovery.md, docs/own-image.md, docs/workflow.md and
	// rootfs/; change it with them. All text comes from the catalogue; the
	// links are fixed here.
	import { onMount } from 'svelte';
	import TrustBox from './TrustBox.svelte';
	import { RUNTIME_ITEM_HASH } from './trust.js';

	let { t } = $props();
	const d = $derived(t.diagram);

	const REPO = 'https://github.com/Le-Space/paperless-anywhere';
	const DOC = (file) => `${REPO}/blob/main/docs/${file}`;
	const LINKS = {
		runtime: [`https://api2.aleph.im/api/v0/messages/${RUNTIME_ITEM_HASH}`],
		vm: ['https://explorer.aleph.im/'],
		amd: ['https://www.amd.com/en/developer/sev.html'],
		image: [`${REPO}/blob/main/rootfs/build-image.sh`, `${REPO}/blob/main/.github/workflows/rootfs.yml`, `${REPO}/actions/workflows/rootfs.yml`],
		data: [`${REPO}/blob/main/rootfs/files/paperless-data-disk`],
		backups: ['https://filfox.info/'],
		app: [`${REPO}/releases`],
		docs: [DOC('security-model.md'), DOC('keys-and-recovery.md'), DOC('own-image.md'), DOC('workflow.md')]
	};

	// Two drawings of the same thing: a wide one, and a tall one for a phone.
	const WIDE = {
		w: 960,
		h: 465,
		build: { x: 10, y: 40, w: 190, h: 150 },
		store: { x: 225, y: 40, w: 190, h: 150 },
		vm: { x: 440, y: 20, w: 300, h: 290 },
		measured: { x: 455, y: 98, w: 270, h: 52 },
		image: { x: 455, y: 158, w: 270, h: 70 },
		data: { x: 455, y: 236, w: 270, h: 62 },
		backup: { x: 765, y: 40, w: 185, h: 150 },
		you: { x: 440, y: 350, w: 300, h: 105 },
		legend: { x: 10, y: 350, w: 405, h: 105 },
		arrows: ['M200 115H221', 'M415 115H436', 'M740 115H761'],
		link: 'M590 314V346'
	};
	const TALL = {
		w: 360,
		h: 985,
		build: { x: 10, y: 10, w: 320, h: 115 },
		store: { x: 10, y: 150, w: 320, h: 115 },
		vm: { x: 10, y: 290, w: 320, h: 290 },
		measured: { x: 25, y: 368, w: 290, h: 52 },
		image: { x: 25, y: 428, w: 290, h: 70 },
		data: { x: 25, y: 506, w: 290, h: 62 },
		backup: { x: 10, y: 605, w: 320, h: 115 },
		you: { x: 10, y: 745, w: 320, h: 105 },
		legend: { x: 10, y: 870, w: 320, h: 105 },
		arrows: ['M170 125V146', 'M170 265V286', 'M170 580V601'],
		link: 'M334 797H350V435H334'
	};
	const KEYS = /** @type {const} */ (['image', 'data', 'vault']);

	// The table and the sources are folded (<details>, so they open without
	// JavaScript too); what the hardware confirms and what it does not yet
	// stay open. A link to a folded part, or into it, opens it.
	onMount(() => {
		const openTarget = () => {
			const id = decodeURIComponent(location.hash.slice(1));
			const part = id ? document.getElementById(id)?.closest('details.fold') : null;
			if (!(part instanceof HTMLDetailsElement) || part.open) return;
			part.open = true;
			part.scrollIntoView();
		};
		openTarget();
		addEventListener('hashchange', openTarget);
		return () => removeEventListener('hashchange', openTarget);
	});
</script>

{#snippet drawing(/** @type {typeof WIDE} */ L, /** @type {string} */ id)}
	<svg class="diagram {id}" viewBox="0 0 {L.w} {L.h}" role="img" aria-labelledby="{id}-title">
		<title id="{id}-title">{t.diagramLabel}</title>
		<defs>
			<marker id="{id}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
				<path d="M0 0L10 5L0 10z" class="head" />
			</marker>
		</defs>
		<TrustBox {...L.build} {...d.build} key="image" />
		<TrustBox {...L.store} {...d.store} />
		<TrustBox {...L.vm} {...d.vm} tone="outer" />
		<TrustBox {...L.measured} {...d.measured} tone="ok" />
		<TrustBox {...L.image} {...d.image} tone="warn" key="image" />
		<TrustBox {...L.data} {...d.data} key="data" />
		<TrustBox {...L.backup} {...d.backup} key="vault" />
		<TrustBox {...L.you} {...d.you} key="vault" />
		{#each L.arrows as a}<path class="arrow" d={a} marker-end="url(#{id}-arrow)" />{/each}
		<path class="arrow link" d={L.link} marker-start="url(#{id}-arrow)" marker-end="url(#{id}-arrow)" />
		<g class="legend">
			<rect x={L.legend.x} y={L.legend.y} width={L.legend.w} height={L.legend.h} rx="12" />
			<text class="lt" x={L.legend.x + 14} y={L.legend.y + 22}>{d.legend}</text>
			{#each KEYS as k, i}
				<circle class="dot {k}" cx={L.legend.x + 20} cy={L.legend.y + 43 + i * 21} r="6" />
				<text x={L.legend.x + 34} y={L.legend.y + 47 + i * 21}>{d.keys[k]}</text>
			{/each}
		</g>
	</svg>
{/snippet}

<figure class="figure" data-testid="trust-diagram">
	{@render drawing(WIDE, 'trust-wide')}
	{@render drawing(TALL, 'trust-tall')}
</figure>

<div class="attest">
	<div class="proves">
		<h3>{t.attestTitle}</h3>
		<ul data-testid="trust-proves">{#each t.proves as p}<li>{p}</li>{/each}</ul>
	</div>
	<div class="gaps">
		<h3>{t.gapsTitle}</h3>
		<ul data-testid="trust-gaps">{#each t.gaps as g}<li>{g}</li>{/each}</ul>
	</div>
</div>

<details class="fold" id="trust-secrets">
	<summary><h3>{t.secretsTitle}</h3><span class="count">{t.fold.secrets(t.secrets.length)}</span></summary>
	<div class="secrets" data-testid="trust-secrets" role="table" aria-label={t.secretsTitle}>
		<div class="row head" role="row">
			<span role="columnheader">{t.cols.what}</span><span role="columnheader">{t.cols.has}</span><span role="columnheader">{t.cols.not}</span>
		</div>
		{#each t.secrets as s}
			<div class="row" role="row">
				<span role="cell" class="what"><span class="dot {s.key}" aria-hidden="true"></span><span><strong>{s.what}</strong><small>{s.d}</small></span></span>
				<span role="cell"><em class="label">{t.cols.has}</em>{s.has}</span>
				<span role="cell" class="not"><em class="label">{t.cols.not}</em>{s.not}</span>
			</div>
		{/each}
	</div>
</details>

<details class="fold" id="trust-verify">
	<summary><h3>{t.verifyTitle}</h3><span class="count">{t.fold.verify(Object.keys(LINKS).length)}</span></summary>
	<ul class="verify" data-testid="trust-verify">
		{#each Object.entries(LINKS) as [id, hrefs]}
			<li>
				<strong>{t.verify[id].t}</strong>
				<p>{t.verify[id].d}</p>
				<p class="links">{#each hrefs as href, i}<a {href} rel="noreferrer">{t.verify[id].links[i]}</a>{/each}</p>
			</li>
		{/each}
	</ul>
</details>
<p class="note">{t.repoNote}</p>

<style>
	.figure { margin: 1.5rem 0 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; box-shadow: var(--shadow); }
	.diagram { display: block; width: 100%; height: auto; }
	.diagram.trust-tall { display: none; max-width: 420px; margin: 0 auto; }
	@media (max-width: 700px) {
		.figure { padding: 0.5rem; }
		.diagram.trust-wide { display: none; }
		.diagram.trust-tall { display: block; }
	}
	.arrow { fill: none; stroke: var(--text-2); stroke-width: 2; }
	.arrow.link { stroke: var(--accent-2-text); stroke-dasharray: 4 3; }
	.head { fill: var(--text-2); }
	.legend rect { fill: var(--surface-2); stroke: none; }
	.legend text { fill: var(--text-2); font-family: var(--font); font-size: 12.5px; }
	.legend .lt { fill: var(--text); font-weight: 600; font-size: 13.5px; }
	.dot { stroke: var(--surface); stroke-width: 2; }
	.dot.image { fill: var(--warn); }
	.dot.data { fill: var(--ok); }
	.dot.vault { fill: var(--accent-2-text); }
	span.dot { flex: none; display: inline-block; width: 0.75rem; height: 0.75rem; border-radius: 50%; margin-top: 0.35rem; border: 0; }
	span.dot.image { background: var(--warn); }
	span.dot.data { background: var(--ok); }
	span.dot.vault { background: var(--accent-2-text); }

	h3 { margin: 2rem 0 0.75rem; }
	.secrets { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
	.row { display: grid; grid-template-columns: 1.1fr 1.5fr 0.9fr; gap: 1rem; padding: 0.9rem 1.1rem; border-top: 1px solid var(--line); font-size: 0.93rem; }
	.row.head { border-top: 0; background: var(--surface-2); font-weight: 600; font-size: 0.85rem; color: var(--text-2); }
	.what { display: flex; gap: 0.6rem; }
	.what small { display: block; color: var(--text-2); margin-top: 0.2rem; }
	.not { color: var(--text-2); }
	.label { display: none; }
	@media (max-width: 700px) {
		.row { grid-template-columns: 1fr; gap: 0.4rem; }
		.row.head { display: none; }
		.label { display: block; font-style: normal; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent-text); font-family: var(--mono); }
	}

	.fold { margin-top: 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); scroll-margin-top: 5rem; }
	.fold > summary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem; padding: 0.9rem 1.1rem; cursor: pointer; list-style: none; border-radius: var(--radius); }
	.fold > summary::-webkit-details-marker { display: none; }
	.fold > summary::before { content: '▸'; color: var(--accent-text); }
	.fold[open] > summary::before { content: '▾'; }
	.fold > summary:focus-visible { outline: 2px solid var(--accent-2-text); outline-offset: 2px; }
	.fold > summary h3 { margin: 0; font-size: 1.05rem; }
	.fold .count { color: var(--text-2); font-size: 0.85rem; }
	.fold > :not(summary) { margin-left: 1.1rem; margin-right: 1.1rem; }
	.fold > :last-child:not(summary) { margin-bottom: 1.1rem; }
	.fold .secrets { border-radius: var(--radius-sm); }
	.fold .verify li { background: var(--surface-2); }

	.attest { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.25rem; }
	.attest > div { border-radius: var(--radius); padding: 0.25rem 1.25rem 1rem; }
	.proves { background: var(--ok-bg); }
	.gaps { background: var(--warn-bg); }
	.proves h3 { color: var(--ok); }
	.gaps h3 { color: var(--warn); }
	.attest h3 { margin-top: 1rem; }
	.attest ul { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.5rem; font-size: 0.93rem; }
	@media (max-width: 700px) {
		.attest { grid-template-columns: 1fr; }
	}

	.verify { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
	.verify li { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 0.9rem 1rem; }
	.verify p { margin: 0.3rem 0 0; color: var(--text-2); font-size: 0.9rem; overflow-wrap: anywhere; }
	.links { display: flex; flex-wrap: wrap; gap: 0.25rem 0.9rem; }
	.links a { color: var(--accent-2-text); }
	.note { color: var(--text-2); font-size: 0.85rem; margin-top: 1rem; }
</style>
