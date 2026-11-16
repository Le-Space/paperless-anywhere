<script>
	// "How do I know my backup is still there?": Proof of Data Possession on
	// Filecoin Warm Storage, short for everyone, then the maths in a fold, the
	// chance a loss shows (computed from the contract's parameters), and what
	// PDP does not prove. Details and sources: docs/backup-proofs.md.
	import { DETECTION_ROWS, DOCS_URL } from '$lib/landing/pdp.js';

	/** @type {{ t: any, lang: 'de' | 'en' }} */
	let { t, lang } = $props();
	const pct = (/** @type {number} */ p) => {
		if (p >= 1) return '100 %';
		if (p > 0.9999) return '> 99,99 %'.replace(',', lang === 'de' ? ',' : '.');
		const v = p * 100;
		return `${v.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: v < 10 || v > 90 ? 1 : 0 })} %`;
	};
	const share = (/** @type {number} */ f) => `${(f * 100).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1 })} %`;
</script>

<div class="proof" id="proof" data-testid="backup-proof">
	<h3>{t.title}</h3>
	<ul class="short">
		{#each t.short as line}<li>{line}</li>{/each}
	</ul>
	<p class="name">{t.name}</p>
	<p class="in-app" data-testid="backup-proof-app">{t.inApp}</p>
	<details class="maths" data-testid="backup-proof-maths">
		<summary>{t.mathsTitle}</summary>
		<ol class="steps">
			{#each t.steps as s}<li><strong>{s.t}.</strong> {s.d}</li>{/each}
		</ol>
		<p>{t.params}</p>
		<p>{t.formula}</p>
		<div class="scroll">
			<table data-testid="backup-proof-table">
				<thead><tr><th scope="col">{t.table.missing}</th>{#each [1, 7, 30] as d}<th scope="col">{t.table.within(d)}</th>{/each}</tr></thead>
				<tbody>
					{#each DETECTION_ROWS as row}
						<tr><th scope="row">{share(row.f)}{#if row.f === 1}{' '}<small>{t.table.gone}</small>{/if}</th>{#each row.days as p}<td>{pct(p)}</td>{/each}</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="note">{t.tableNote}</p>
		<h4>{t.limitsTitle}</h4>
		<ul class="limits">
			{#each t.limits as line}<li>{line}</li>{/each}
		</ul>
		<p><a href={DOCS_URL} target="_blank" rel="noopener">{t.more}</a></p>
	</details>
</div>

<style>
	.proof { margin: 2rem 0 0; padding: 1.5rem; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
	h3 { margin: 0 0 0.75rem; font-size: 1.25rem; }
	h4 { margin: 1.25rem 0 0.5rem; font-size: 1rem; }
	.short { margin: 0; padding-left: 1.2rem; display: grid; gap: 0.4rem; line-height: 1.5; }
	.name { color: var(--text-2); font-size: 0.9rem; margin: 0.75rem 0 0; }
	.in-app { margin: 0.75rem 0 0; padding: 0.75rem 1rem; border-radius: var(--radius-sm); background: var(--surface-2); line-height: 1.5; }
	.maths { margin-top: 1rem; }
	.maths summary { cursor: pointer; font-weight: 600; }
	.maths p { line-height: 1.55; }
	.steps { padding-left: 1.4rem; display: grid; gap: 0.45rem; line-height: 1.5; }
	.scroll { overflow-x: auto; }
	table { border-collapse: collapse; min-width: 28rem; font-variant-numeric: tabular-nums; }
	th, td { padding: 0.45rem 0.8rem; border-bottom: 1px solid var(--line); text-align: right; }
	th[scope='row'], thead th:first-child { text-align: left; }
	thead th { color: var(--text-2); font-weight: 600; font-size: 0.85rem; }
	small { color: var(--text-2); }
	.note { color: var(--text-2); font-size: 0.9rem; }
	.limits { padding-left: 1.2rem; display: grid; gap: 0.4rem; line-height: 1.5; }
</style>
