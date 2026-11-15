<script>
	// The certificate of this vault's own image: when it was built, that only
	// the vault knows its passphrase, and the values anyone can check, each
	// linked to its evidence (the plain image and the builder fixed in the app,
	// the image's STORE on Aleph, the source it was built from). "Als PDF
	// speichern" prints just this card; the browser's dialog saves it as PDF.
	import { ALEPH_MESSAGE, REPOSITORY } from '$lib/own-image.js';
	import { format, lang, t } from '$lib/i18n/index.js';

	/** @type {{ ownImage: { builtAt: string, plainSha256: string, builder?: { vprogram?: string | null, measurement?: string | null } | null }, imageHash: string, plain?: { sha256: string, store?: string, commit?: string } | null, onDark?: boolean, onback?: () => void }} */
	let { ownImage, imageHash, plain = null, onDark = false, onback } = $props();

	const x = $derived($t.first.cert);
	const short = (/** @type {string | null | undefined} */ v) => (v ? `${v.slice(0, 8)} … ${v.slice(-8)}` : '–');
	const measurement = $derived(ownImage.builder?.measurement ?? null);
</script>

<div class="cert" class:on-dark={onDark} data-testid="certificate">
	<div class="frame">
		<div class="head">
			<div>
				<p class="kicker">{x.kicker}</p>
				<h2>{x.title}</h2>
			</div>
			<div class="seal" aria-hidden="true">
				<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>
			</div>
		</div>
		<p class="lead">{x.lead}</p>
		<dl>
			<div><dt>{x.builtAt}</dt><dd data-testid="cert-built">{format.date(ownImage.builtAt, { day: 'numeric', month: 'long', year: 'numeric' }, $lang)}</dd></div>
			<div><dt>{x.passphrase}</dt><dd class="ok">{x.onlyVault}</dd></div>
			<div><dt>{x.plain}</dt><dd>{#if plain?.store}<a href={`${ALEPH_MESSAGE}/${plain.store}`} target="_blank" rel="noopener noreferrer"><code>{short(ownImage.plainSha256)}</code></a>{:else}<code>{short(ownImage.plainSha256)}</code>{/if}</dd></div>
			{#if measurement}<div><dt>{x.builder}</dt><dd>{#if ownImage.builder?.vprogram}<a href={`${ALEPH_MESSAGE}/${ownImage.builder.vprogram}`} target="_blank" rel="noopener noreferrer"><code>{short(measurement)}</code></a>{:else}<code>{short(measurement)}</code>{/if}</dd></div>{/if}
			<div><dt>{x.store}</dt><dd><a href={`${ALEPH_MESSAGE}/${imageHash}`} target="_blank" rel="noopener noreferrer" data-testid="cert-store"><code>{short(imageHash)}</code></a></dd></div>
			{#if plain?.commit}<div><dt>{x.commit}</dt><dd><a href={`${REPOSITORY}/commit/${plain.commit}`} target="_blank" rel="noopener noreferrer"><code>{plain.commit.slice(0, 7)}</code></a></dd></div>{/if}
		</dl>
	</div>
	<p class="row no-print">
		<button type="button" class="cta" onclick={() => window.print()} data-testid="cert-print">{x.print}</button>
		{#if onback}<button type="button" class="link" onclick={onback}>{x.back}</button>{/if}
	</p>
</div>

<style>
	.cert { width: 100%; max-width: 46rem; display: flex; flex-direction: column; gap: 1rem; color: var(--text); }
	.frame { background: var(--surface); border: 2px solid var(--accent); border-radius: var(--radius); padding: 2rem; display: flex; flex-direction: column; gap: 1.25rem; position: relative; }
	.frame::before { content: ''; position: absolute; inset: 8px; border: 1px solid var(--line); border-radius: calc(var(--radius) - 6px); pointer-events: none; }
	.head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; }
	.kicker { margin: 0; font-size: 0.8rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-text); }
	h2 { margin: 0.25rem 0 0; font-size: 1.8rem; }
	.seal { width: 5rem; height: 5rem; border-radius: 50%; background: var(--accent); color: var(--accent-ink); display: flex; align-items: center; justify-content: center; }
	.lead { margin: 0; color: var(--text-2); line-height: 1.55; }
	dl { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem 1.75rem; }
	@media (max-width: 560px) { dl { grid-template-columns: 1fr; } }
	dt { font-size: 0.8rem; color: var(--text-2); }
	dd { margin: 0.2rem 0 0; font-weight: 600; overflow-wrap: anywhere; }
	dd.ok { color: var(--ok); }
	code { font-family: var(--mono); font-size: 0.85rem; }
	.row { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 0; }
	.cta { padding: 0.7rem 1.3rem; border-radius: 999px; border: none; background: var(--cta-bg); color: var(--cta-text); font-weight: 600; cursor: pointer; }
	.link { background: none; border: none; color: var(--text-2); text-decoration: underline; cursor: pointer; }
	.on-dark .cta { background: #f6f2ea; color: #0f2a2e; }
	.on-dark .link { color: rgba(246, 242, 234, 0.85); }
	@media print {
		:global(body *) { visibility: hidden; }
		.cert, .cert :global(*) { visibility: visible; }
		.cert { position: absolute; inset: 0; margin: 0 auto; }
		.no-print { display: none; }
	}
</style>
