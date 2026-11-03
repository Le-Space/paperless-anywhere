<script>
	// Which build this is: the release, when it was built, its commit, and the
	// IPFS CID the gateway serves it from (Aleph's x-ipfs-roots header, asked
	// of this page's own origin; absent when not served from IPFS).
	/* global __BUILD__ */
	const build = __BUILD__;
	const time = new Date(build.time).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
	let cid = $state('');
	$effect(() => {
		fetch(location.href, { method: 'HEAD', cache: 'no-store' })
			.then((res) => (cid = res.headers.get('x-ipfs-roots')?.split(',')[0]?.trim() ?? ''))
			.catch(() => {});
	});
</script>

<footer data-testid="build-info">
	<span data-testid="build-version">{build.version}</span>
	· <time datetime={build.time}>{time}</time>
	{#if build.commit}· <code title="Commit">{build.commit}</code>{/if}
	{#if cid}<br /><span title="IPFS-CID dieser Version">IPFS: <code>{cid}</code></span>{/if}
</footer>

<style>
	footer { margin: 3rem 0 1rem; color: #888; font-size: 0.8rem; }
	code { word-break: break-all; }
</style>
