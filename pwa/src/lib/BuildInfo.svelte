<script>
	// Which build this is: the release, when it was built, its commit, and the
	// IPFS CID the gateway serves it from (Aleph's x-ipfs-roots header, asked
	// of this page's own origin; absent when not served from IPFS).
	/* global __BUILD__ */
	import { CREDITS_URL, cancelMailto } from '$lib/credits.js';
	import { format, lang, t } from '$lib/i18n/index.js';

	const build = __BUILD__;
	const time = $derived(format.dateTime(build.time, { dateStyle: 'medium', timeStyle: 'short' }, $lang));
	// The landing page of the language shown here.
	const home = $derived($lang === 'en' ? '/en/' : '/');
	let cid = $state('');
	$effect(() => {
		fetch(location.href, { method: 'HEAD', cache: 'no-store' })
			.then((res) => (cid = res.headers.get('x-ipfs-roots')?.split(',')[0]?.trim() ?? ''))
			.catch(() => {});
	});
</script>

<footer data-testid="build-info">
	<nav class="legal" aria-label={$t.app.footer.legal}>
		<a href={home}>{$t.app.footer.about}</a>
		<a href="https://le-space.de/#impressum">{$t.app.footer.imprint}</a>
		<a href="https://le-space.de/#datenschutz">{$t.app.footer.privacy}</a>
		<a href="/lizenzen/">{$t.app.footer.licences}</a>
		<!-- Reachable at any time, also with the vault locked or lost (§ 312k BGB):
		     with an open vault the package card cancels in place and at once. -->
		{#if CREDITS_URL}<a href={cancelMailto()} data-testid="cancel-by-mail" title={$t.app.footer.cancelHint}>{$t.app.footer.cancel}</a>{/if}
	</nav>
	<span data-testid="build-version">{build.version}</span>
	· <time datetime={build.time}>{time}</time>
	{#if build.commit}· <code title={$t.app.footer.commit}>{build.commit}</code>{/if}
	{#if cid}<br /><span title={$t.app.footer.cid}>IPFS: <code>{cid}</code></span>{/if}
</footer>

<style>
	footer { margin: 3rem 0 1rem; color: var(--text-2); font-size: 0.8rem; }
	code { word-break: break-all; }
	.legal { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; margin-bottom: 0.5rem; }
	.legal a { color: var(--text-2); }
</style>
