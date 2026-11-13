<script>
	// The evidence of one VM (evidence.js): one row per claim, each with the
	// way the app knows it (checked by the app, only reported, not confirmed),
	// its values and where to check it. Folded; every value is text.
	import { tally } from '$lib/evidence.js';

	/** @type {{ rows: import('$lib/evidence.js').Row[], t: typeof import('$lib/evidence-i18n.js').evidenceTexts.de, sample?: boolean, open?: boolean, onagain?: (() => Promise<unknown>) | null }} */
	let { rows, t, sample = false, open = false, onagain = null } = $props();
	const n = $derived(tally(rows));
	const SIGN = { app: '✓', reported: '•', open: '○' };
	let checking = $state(false);
	let result = $state('');
	async function again() {
		if (!onagain || checking) return;
		checking = true;
		result = '';
		try {
			await onagain();
			result = t.checked;
		} catch (e) {
			result = t.failed(e instanceof Error ? e.message : String(e));
		} finally {
			checking = false;
		}
	}
</script>

<details class="evidence" data-testid="evidence" {open}>
	<summary>
		<strong>{t.title}</strong>
		{#if sample}<span class="sample" data-testid="evidence-sample">{t.sample}</span>{/if}
		<span class="tally" data-testid="evidence-tally">{t.summary(n.app, n.reported, n.open)}</span>
	</summary>
	<ul class="legend" aria-hidden="true">
		{#each /** @type {const} */ (['app', 'reported', 'open']) as m}<li class={m}><span class="sign">{SIGN[m]}</span>{t.marks[m]}</li>{/each}
	</ul>
	<ol class="rows">
		{#each rows as row (row.id)}
			<li class="row {row.mark}" data-testid="evidence-{row.id}" data-mark={row.mark}>
				<p class="head"><span class="sign" aria-hidden="true">{SIGN[row.mark]}</span><strong>{t.rows[row.id].t}</strong><span class="mark">{t.marks[row.mark]}</span></p>
				<p class="d">{t.rows[row.id].d}</p>
				{#if row.note}<p class="note">{t.notes[row.note]}</p>{/if}
				{#if row.values.length}
					<dl>
						{#each row.values as v}<dt>{t.values[v.k]}</dt><dd class:mono={v.mono}>{v.v}</dd>{/each}
					</dl>
				{/if}
				{#if row.links.length}<p class="links">{#each row.links as l}<a href={l.href} target="_blank" rel="noopener noreferrer">{t.links[l.k]}</a>{/each}</p>{/if}
				{#if row.id === 'attestation' && onagain}
					<p class="again">
						<button type="button" class="small" onclick={again} disabled={checking} data-testid="evidence-again">{checking ? t.checking : t.again}</button>
						<span role="status" data-testid="evidence-again-result">{result}</span>
					</p>
				{/if}
			</li>
		{/each}
	</ol>
</details>

<style>
	.evidence { margin: 1rem 0 0; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); text-align: left; }
	summary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.75rem; padding: 0.7rem 0.9rem; cursor: pointer; }
	.tally { color: var(--text-2); font-size: 0.85rem; }
	.sample { font-size: 0.8rem; padding: 0.05rem 0.5rem; border-radius: 999px; background: var(--warn-bg); color: var(--warn); font-weight: 600; }
	.legend, .rows { list-style: none; margin: 0; padding: 0; }
	.legend { display: flex; flex-wrap: wrap; gap: 0.2rem 1rem; padding: 0 0.9rem 0.6rem; font-size: 0.8rem; color: var(--text-2); }
	.sign { display: inline-block; width: 1.1rem; font-weight: 700; }
	.app .sign { color: var(--ok); }
	.reported .sign { color: var(--accent-2-text); }
	.open .sign { color: var(--warn); }
	.row { padding: 0.7rem 0.9rem; border-top: 1px solid var(--line); font-size: 0.9rem; }
	.row p { margin: 0; }
	.head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 0.4rem; }
	.mark { font-size: 0.8rem; color: var(--text-2); }
	.d { color: var(--text-2); margin-top: 0.15rem; }
	.row .note { margin-top: 0.35rem; }
	.row.open .note { padding: 0.35rem 0.6rem; border-radius: var(--radius-sm); background: var(--warn-bg); }
	dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 0.15rem 0.75rem; margin: 0.4rem 0 0; }
	dt { color: var(--text-2); }
	dd { margin: 0; overflow-wrap: anywhere; }
	.mono { font-family: var(--mono); font-size: 0.8rem; }
	@media (max-width: 480px) { dl { grid-template-columns: 1fr; } dt { margin-top: 0.25rem; } }
	.links { display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; margin-top: 0.4rem; }
	.links a { color: var(--accent-2-text); }
	.again { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.75rem; margin-top: 0.5rem; }
	.small { padding: 0.35rem 0.85rem; font-size: 0.875rem; background: var(--surface); color: var(--text); border-color: var(--line); }
</style>
