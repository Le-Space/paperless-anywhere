<script>
	// The terms (AGB): agree to the version in force before buying, and to an
	// announced one before it takes effect (§ 9 of the terms). Shows nothing
	// while no version is published.
	import { acceptTerms, creditsTerms, termsPage, termsRefused } from '$lib/credits.js';
	import { format, lang, t } from '$lib/i18n/index.js';

	/** @type {{ master: Uint8Array, terms: ReturnType<typeof import('$lib/credits.js').termsOf> | null, onaccepted?: () => void }} */
	let { master, terms, onaccepted = () => {} } = $props();

	/** @type {Awaited<ReturnType<typeof creditsTerms>>} */
	let published = $state(null);
	let busy = $state(false);
	let error = $state('');
	let read = $state(false);
	// The version in force is asked for when it is not agreed, or when a
	// purchase was refused for it (the announced one agreed alone, elsewhere).
	const due = $derived(Boolean(terms?.current && (terms.due || ($termsRefused && terms.accepted?.version !== terms.current))));
	$effect(() => {
		if (due || terms?.announced) creditsTerms().then((t) => (published = t)).catch(() => {});
	});
	// What the balance names, until (or unless) the published list answers:
	// the version and its own page, so the notice never waits for it.
	const fallback = (/** @type {string | null | undefined} */ version, /** @type {string | null} */ effectiveAt = null) =>
		version ? { version, date: null, url: termsPage(version, null), sha256: '', changes: /** @type {string[]} */ ([]), effectiveAt } : null;
	const target = $derived(
		due
			? published?.current?.version === terms?.current ? published?.current : fallback(terms?.current)
			: terms?.announced
				? published?.pending?.version === terms?.pending?.version ? published?.pending : fallback(terms?.pending?.version, terms?.pending?.effectiveAt ?? null)
				: null
	);
	// A version takes effect on a day in Germany (the service sends midnight UTC).
	const day = (/** @type {string | null} */ iso) => (iso ? format.date(iso, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }, $lang) : '');
	const x = $derived($t.buy.terms);

	async function agree() {
		if (!target) return;
		busy = true;
		error = '';
		try {
			await acceptTerms(master, target.version);
			if (due) termsRefused.set(false);
			read = false;
			onaccepted();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

{#if target}
	<div class="terms" class:due role="region" aria-label={x.label} data-testid="terms">
		<p class="title">{due ? x.due : x.announced(day(target.effectiveAt))}</p>
		{#if $lang !== 'de'}<p class="hint" data-testid="terms-german-note">{x.germanNote}</p>{/if}
		<p class="hint" lang="de">{due ? x.legal.dueHint : x.legal.announcedHint}</p>
		{#if target.changes.length}<ul lang="de">{#each target.changes as c (c)}<li>{c}</li>{/each}</ul>{/if}
		{#if target.url}<p><a href={target.url} target="_blank" rel="noopener noreferrer" data-testid="terms-link">{x.read(target.version, day(target.date))}</a></p>{/if}
		<label class="check"><input type="checkbox" bind:checked={read} data-testid="terms-read" /> <span lang="de">{x.legal.consent(target.version)}</span></label>
		<button type="button" class="small" onclick={agree} disabled={busy || !read} data-testid="terms-accept">{x.agree}</button>
		{#if error}<p class="warn" role="alert">{error}</p>{/if}
	</div>
{:else if terms?.accepted}
	<p class="hint small-print" data-testid="terms-accepted">{x.accepted(terms.accepted.version, day(terms.accepted.acceptedAt))}{#if terms.accepted.url}{' · '}<a href={terms.accepted.url} target="_blank" rel="noopener noreferrer">{x.readLink}</a>{/if}</p>
{/if}

<style>
	.terms { margin: 0 0 1rem; padding: 0.9rem 1rem; border-radius: var(--radius-sm); background: var(--surface-2); border-left: 4px solid var(--accent); }
	.terms.due { border-left-color: var(--warn); background: var(--warn-bg); }
	.terms p { margin: 0.2rem 0; }
	.title { font-weight: 600; }
	.hint { color: var(--text-2); font-size: 0.875rem; }
	.small-print { margin: 0.75rem 0 0; font-size: 0.8rem; }
	ul { margin: 0.3rem 0; padding-left: 1.2rem; font-size: 0.9rem; }
	.check { display: flex; gap: 0.5rem; align-items: flex-start; margin: 0.5rem 0 0; font-size: 0.9rem; }
	.check input { width: auto; margin-top: 0.2rem; }
	.small { margin-top: 0.5rem; padding: 0.35rem 0.85rem; font-size: 0.875rem; }
	.warn { color: var(--warn); }
</style>
