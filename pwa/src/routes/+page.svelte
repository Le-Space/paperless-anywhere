<script>
	// The landing page at /; the app is at /app/ on the same origin.
	import { onMount } from 'svelte';
	import Logo from '$lib/Logo.svelte';
	import TeeNodes from '$lib/landing/TeeNodes.svelte';
	import StorageProviders from '$lib/landing/StorageProviders.svelte';
	import { LANGS, initialLang, texts } from '$lib/landing/i18n.js';
	import { CREDITS_URL, PLANS, creditsCatalog } from '$lib/credits.js';

	const APP = '/app/';
	// Link previews need absolute addresses.
	const SITE = 'https://paperless.le-space.de/';
	const OG_IMAGE = `${SITE}og.png`;
	// German in the prerendered HTML (what link previews read); the visitor's
	// language is picked once the page runs.
	let lang = $state(/** @type {'de' | 'en'} */ ('de'));
	const t = $derived(texts[lang]);
	let plans = $state(PLANS);

	function setLang(/** @type {'de' | 'en'} */ l) {
		lang = l;
		try {
			localStorage.setItem('paperless-lang', l);
		} catch {
			/* not remembered */
		}
	}
	$effect(() => {
		document.documentElement.lang = lang;
	});

	// Le Space Credits: 100 credits are 1 €.
	const euro = (credits) => new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR', maximumFractionDigits: credits % 100 ? 2 : 0 }).format(credits / 100);

	onMount(() => {
		lang = initialLang();
		creditsCatalog()
			.then((c) => {
				if (c?.plans?.length) plans = c.plans;
			})
			.catch(() => {});
	});
</script>

<svelte:head>
	<title>{t.title}</title>
	<meta name="description" content={t.description} />
	<link rel="canonical" href={SITE} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Paperless anywhere" />
	<meta property="og:url" content={SITE} />
	<meta property="og:title" content={t.title} />
	<meta property="og:description" content={t.description} />
	<meta property="og:locale" content={lang === 'de' ? 'de_DE' : 'en_US'} />
	<meta property="og:locale:alternate" content={lang === 'de' ? 'en_US' : 'de_DE'} />
	<meta property="og:image" content={OG_IMAGE} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={t.ogImageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={t.title} />
	<meta name="twitter:description" content={t.description} />
	<meta name="twitter:image" content={OG_IMAGE} />
	<meta name="twitter:image:alt" content={t.ogImageAlt} />
</svelte:head>

<header class="top">
	<a class="brand" href="/" aria-label="Paperless anywhere"><Logo size={34} name="paperless" /></a>
	<nav aria-label="Sections">
		<a href="#how">{t.nav.how}</a>
		<a href="#tee">{t.nav.tee}</a>
		<a href="#nodes">{t.nav.nodes}</a>
		<a href="#storage">{t.nav.storage}</a>
		<a href="#prices">{t.nav.prices}</a>
	</nav>
	<div class="langs" role="group" aria-label="Language">
		{#each LANGS as l}
			<button class="lang" class:on={lang === l} aria-pressed={lang === l} onclick={() => setLang(l)}>{l.toUpperCase()}</button>
		{/each}
	</div>
</header>

<main>
	<section class="hero">
		<p class="kicker data">{t.hero.kicker}</p>
		<h1>{t.hero.title}</h1>
		<p class="lead">{t.hero.lead}</p>
		<p class="actions"><a class="cta" href={APP}>{t.open} →</a><span class="hint">{t.openHint}</span></p>
		<ul class="points">
			{#each t.points as p}<li><h3>{p.t}</h3><p>{p.d}</p></li>{/each}
		</ul>
	</section>

	<section id="how">
		<h2>{t.how.title}</h2>
		<ol class="steps">
			{#each t.how.steps as s, i}<li><span class="n data">0{i + 1}</span><h3>{s.t}</h3><p>{s.d}</p></li>{/each}
		</ol>
	</section>

	<section id="tee">
		<h2>{t.tee.title}</h2>
		<p class="lead">{t.tee.lead}</p>
		<ul class="cards">
			{#each t.tee.items as it}<li><h3>{it.t}</h3><p>{it.d}</p></li>{/each}
		</ul>
	</section>

	<section id="nodes">
		<h2>{t.nodes.title}</h2>
		<p class="lead">{t.nodes.lead}</p>
		<TeeNodes t={t.nodes} />
	</section>

	<section id="storage">
		<h2>{t.storage.title}</h2>
		<p class="lead">{t.storage.lead}</p>
		<p>{t.storage.choose}</p>
		<StorageProviders t={t.storage} {lang} />
	</section>

	<section id="prices">
		<h2>{t.prices.title}</h2>
		<p class="lead">{t.prices.lead}</p>
		<ul class="plans">
			{#each plans as p, i (p.id)}
				<li class:first={i === 0}>
					<span class="hours">{t.prices.hours(p.hours)}</span>
					<span class="price">{euro(p.priceCredits)}</span>
					<span class="per">{t.prices.perMonth}</span>
				</li>
			{/each}
		</ul>
		<p>{t.prices.example}</p>
	</section>

	<section class="closing">
		<h2>{t.cta.title}</h2>
		<p>{t.cta.lead}</p>
		<p class="actions"><a class="cta" href={APP}>{t.open} →</a></p>
	</section>
</main>

<footer>
	<p class="built">{t.footer.built}</p>
	<p class="built">{t.footer.ngx} <a href="https://github.com/paperless-ngx/paperless-ngx">{t.footer.ngxLink}</a></p>
	<span>{t.footer.by}</span>
	<a href="https://www.belege.le-space.de">{t.footer.belege}</a>
	<a href="https://le-space.de/">le-space.de</a>
	<a href={t.footer.imprintUrl}>{t.footer.imprint}</a>
	<a href={t.footer.privacyUrl}>{t.footer.privacy}</a>
</footer>

<style>
	.top, main, footer { max-width: 1040px; margin: 0 auto; padding: 0 var(--gutter); }
	.top { display: flex; align-items: center; gap: 1.25rem; padding-top: 1.25rem; padding-bottom: 1.25rem; }
	.brand { text-decoration: none; }
	nav { display: flex; gap: 1.1rem; margin-left: auto; font-size: 0.9rem; }
	nav a { color: var(--text-2); text-decoration: none; }
	nav a:hover { color: var(--text); }
	.langs { display: flex; gap: 0.25rem; }
	.lang { font-family: var(--mono); font-size: 0.75rem; padding: 0.25rem 0.55rem; background: transparent; color: var(--text-2); border-color: var(--line); }
	.lang.on { background: var(--cta-bg); color: var(--cta-text); border-color: var(--cta-bg); }

	section { padding: 3.5rem 0 1rem; scroll-margin-top: 1rem; }
	h2 { font-size: 1.75rem; margin: 0 0 0.75rem; }
	.lead { font-size: 1.1rem; color: var(--text-2); max-width: 46rem; }

	.hero { padding-top: 3rem; }
	.kicker { color: var(--accent-text); text-transform: uppercase; letter-spacing: 0.12em; margin: 0 0 1rem; }
	h1 { font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 1.25rem; max-width: 18ch; }
	.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1rem; margin: 2rem 0; }
	.cta { display: inline-block; padding: 0.85rem 1.5rem; border-radius: 999px; background: var(--cta-bg); color: var(--cta-text); font-weight: 600; text-decoration: none; }
	.cta:hover { filter: brightness(1.08); }
	.hint { color: var(--text-2); font-size: 0.9rem; }

	.points, .cards, .steps, .plans { list-style: none; padding: 0; margin: 1.5rem 0 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
	.points li, .cards li, .steps li { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem; box-shadow: var(--shadow); }
	.points h3, .cards h3, .steps h3 { margin: 0 0 0.4rem; }
	.points p, .cards p, .steps p { margin: 0; color: var(--text-2); font-size: 0.95rem; }
	.points li { border-top: 4px solid var(--accent); }
	.n { color: var(--accent-text); font-weight: 500; display: block; margin-bottom: 0.5rem; }

	.plans li { display: flex; flex-direction: column; gap: 0.2rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.5rem; }
	.plans li.first { border: 2px solid var(--accent); }
	.hours { font-weight: 600; }
	.price { font-size: 2.4rem; font-weight: 700; letter-spacing: -0.03em; }
	.per { color: var(--text-2); font-size: 0.9rem; }
	.built { flex-basis: 100%; margin: 0; }
	.built + span { margin-top: 0.5rem; }

	.closing { text-align: center; padding-bottom: 3rem; }
	.closing .actions { justify-content: center; }

	footer { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; padding-top: 2rem; padding-bottom: 2.5rem; border-top: 1px solid var(--line); color: var(--text-2); font-size: 0.85rem; }

	@media (max-width: 820px) {
		nav { display: none; }
		.langs { margin-left: auto; }
	}
</style>
