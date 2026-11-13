<script>
	// The build line of a footer (build-line.js): release, build time, commit.
	/* global __BUILD__ */
	import { buildLine } from './build-line.js';

	/** @type {{ lang: 'de' | 'en', t: { label: string, release: string, commit: string, built: string } }} */
	let { lang, t } = $props();
	const b = $derived(buildLine(__BUILD__, lang));
</script>

<p class="build" data-testid="landing-build">
	{t.label}
	{#if b.releaseHref}<a href={b.releaseHref} title={t.release} data-testid="landing-build-version">{b.version}</a>{:else}<span data-testid="landing-build-version">{b.version}</span>{/if}
	{#if b.time}· <time datetime={b.time} title={t.built} data-testid="landing-build-time">{b.timeText}</time>{/if}
	{#if b.commitHref}· <a href={b.commitHref} title={t.commit} data-testid="landing-build-commit"><code>{b.commit}</code></a>{/if}
</p>

<style>
	.build { flex-basis: 100%; margin: 0; font-size: 0.8rem; color: var(--text-2); }
	.build a { color: var(--text-2); }
	code { font-family: var(--mono); }
</style>
