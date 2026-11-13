<script>
	// /lizenzen: what Paperless anywhere runs and ships, under which licence,
	// and where the source is. Versions and digests come from the rootfs files
	// at build time (__STACK__, scripts/licences.js), never typed in here.
	import { onMount } from 'svelte';
	import Logo from '$lib/Logo.svelte';
	import BuildLine from '$lib/landing/BuildLine.svelte';
	import { LANGS, initialLang, texts } from '$lib/landing/i18n.js';
	import gpl from '$lib/licences/gpl-3.0.txt?raw';

	const REPO = 'https://github.com/Le-Space/paperless-anywhere';
	const SITE = 'https://paperless.le-space.de/lizenzen/';
	/* global __BUILD__, __STACK__ */
	const stack = __STACK__;
	const build = __BUILD__;
	const at = build.commit || 'main';
	const ngx = stack.images.find((i) => i.name === 'paperless');
	const others = stack.images.filter((i) => i.name !== 'paperless');

	let lang = $state(/** @type {'de' | 'en'} */ ('de'));
	const t = $derived(texts[lang]);
	// Back to the landing page in the language shown here.
	const home = $derived(lang === 'en' ? '/en/' : '/');
	const l = $derived(t.licences);
	function setLang(/** @type {'de' | 'en'} */ next) {
		lang = next;
		try {
			localStorage.setItem('paperless-lang', next);
		} catch {
			/* not remembered */
		}
	}
	$effect(() => {
		document.documentElement.lang = lang;
	});
	onMount(() => (lang = initialLang()));
</script>

<svelte:head>
	<title>{l.title}</title>
	<meta name="description" content={l.description} />
	<link rel="canonical" href={SITE} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Paperless anywhere" />
	<meta property="og:url" content={SITE} />
	<meta property="og:title" content={l.title} />
	<meta property="og:description" content={l.description} />
</svelte:head>

<header class="top">
	<a class="brand" href={home} aria-label={l.back}><Logo size={34} name="Paperless anywhere" /></a>
	<div class="langs" role="group" aria-label="Language">
		{#each LANGS as code}
			<button class="lang" class:on={lang === code} aria-pressed={lang === code} onclick={() => setLang(code)}>{code.toUpperCase()}</button>
		{/each}
	</div>
</header>

<main>
	<h1>{l.h1}</h1>
	<p class="lead">{l.lead}</p>

	<section id="paperless-ngx" data-testid="ngx">
		<h2>{l.ngx.title}</h2>
		<p>{l.ngx.intro.split('Paperless-ngx')[0]}<a href="https://github.com/paperless-ngx/paperless-ngx" rel="noopener">Paperless-ngx</a>{l.ngx.intro.split('Paperless-ngx').slice(1).join('Paperless-ngx')}</p>
		<dl>
			<dt>{l.ngx.version}</dt>
			<dd data-testid="ngx-version">{ngx.tag}</dd>
			<dt>{l.ngx.source}</dt>
			<dd><a href={ngx.source} rel="noopener" data-testid="ngx-source">{ngx.source.replace('https://', '')}</a></dd>
			<dt>{l.ngx.licence}</dt>
			<dd><a href="#gpl">GPL-3.0</a></dd>
			<dt>{l.ngx.upstream}</dt>
			<dd><code>{ngx.image}:{ngx.tag}@{ngx.digest}</code></dd>
			<dt>{l.ngx.copy}</dt>
			<dd><code>{ngx.flat}</code></dd>
			<dt>{l.ngx.changes}</dt>
			<dd>
				<p data-testid="ngx-changes">{l.ngx.changesText}</p>
				<p class="refs">
					<a href={`${REPO}/blob/${at}/rootfs/flatten-image.sh`} rel="noopener">{l.ngx.changesHow}</a>
					<a href={`${REPO}/blob/${at}/rootfs/files/compose.yml`} rel="noopener">{l.ngx.changesConfig}</a>
				</p>
			</dd>
		</dl>
	</section>

	<section id="vm">
		<h2>{l.vm.title}</h2>
		<p>{l.vm.lead}</p>
		<div class="scroll">
			<table data-testid="vm-table">
				<thead><tr><th>{l.vm.name}</th><th>{l.vm.version}</th><th>{l.vm.licence}</th><th>{l.vm.source}</th></tr></thead>
				<tbody>
					{#each others as i (i.name)}
						<tr><td>{i.title}</td><td><code>{i.tag}</code></td><td>{i.licence}</td><td><a href={i.source} rel="noopener">{new URL(i.source).host}</a></td></tr>
					{/each}
					{#each stack.tools as tool (tool.title)}
						<tr><td>{tool.title}</td><td>{#if tool.version}<code>{tool.version}</code>{/if}</td><td>{tool.licence}</td><td><a href={tool.source} rel="noopener">{new URL(tool.source).host}</a></td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="app">
		<h2>{l.app.title}</h2>
		<p>{l.app.own} <a href={`${REPO}/blob/${at}/LICENSE`} rel="noopener">{l.app.ownLink}</a></p>
		<p>{l.app.third} <a href="/third-party-licences.txt" data-testid="third-party">{l.app.thirdLink}</a></p>
	</section>

	<section id="gpl">
		<h2>{l.gpl.title}</h2>
		<details>
			<summary>{l.gpl.show}</summary>
			<pre data-testid="gpl-text">{gpl}</pre>
		</details>
	</section>
</main>

<footer>
	<a href={home}>{l.back}</a>
	<a href={t.footer.imprintUrl}>{t.footer.imprint}</a>
	<a href={t.footer.privacyUrl}>{t.footer.privacy}</a>
	<BuildLine {lang} t={t.footer.build} />
</footer>

<style>
	.top, main, footer { max-width: 1040px; margin: 0 auto; padding: 0 var(--gutter); }
	.top { display: flex; align-items: center; gap: 1.25rem; padding-top: 1.25rem; padding-bottom: 1.25rem; }
	.brand { text-decoration: none; }
	.langs { display: flex; gap: 0.25rem; margin-left: auto; }
	.lang { font-family: var(--mono); font-size: 0.75rem; padding: 0.25rem 0.55rem; background: transparent; color: var(--text-2); border-color: var(--line); }
	.lang.on { background: var(--cta-bg); color: var(--cta-text); border-color: var(--cta-bg); }
	h1 { font-size: clamp(2rem, 5vw, 3rem); letter-spacing: -0.03em; margin: 2rem 0 0.75rem; }
	.lead { font-size: 1.1rem; color: var(--text-2); max-width: 46rem; }
	section { padding: 2rem 0 0.5rem; }
	h2 { font-size: 1.5rem; margin: 0 0 0.75rem; }
	dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.5rem 1.25rem; margin: 1rem 0 0; }
	dt { color: var(--text-2); }
	dd { margin: 0; min-width: 0; }
	dd p { margin: 0; }
	code { font-family: var(--mono); font-size: 0.85rem; overflow-wrap: anywhere; }
	.refs { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; margin-top: 0.4rem; }
	.scroll { overflow-x: auto; }
	table { border-collapse: collapse; width: 100%; font-size: 0.95rem; }
	th, td { text-align: left; padding: 0.5rem 0.75rem 0.5rem 0; border-bottom: 1px solid var(--line); vertical-align: top; }
	th { color: var(--text-2); font-weight: 500; }
	pre { font-family: var(--mono); font-size: 0.8rem; white-space: pre-wrap; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; max-height: 32rem; overflow: auto; }
	summary { cursor: pointer; }
	footer { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; margin-top: 3rem; padding-top: 2rem; padding-bottom: 2.5rem; border-top: 1px solid var(--line); color: var(--text-2); font-size: 0.85rem; }

	@media (max-width: 640px) {
		dl { grid-template-columns: 1fr; gap: 0.15rem; }
		dd { margin-bottom: 0.6rem; }
	}
</style>
