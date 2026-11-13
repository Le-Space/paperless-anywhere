<script>
	// The landing page: German at /, English at /en/, each rendered at build
	// time in its language, so a shared link shows that language's preview
	// (crawlers run no scripts). The app is at /app/ on the same origin.
	import { onMount } from 'svelte';
	import Logo from '$lib/Logo.svelte';
	import NgxText, { NGX_URL } from '$lib/NgxText.svelte';
	import TeeNodes from '$lib/landing/TeeNodes.svelte';
	import StorageProviders from '$lib/landing/StorageProviders.svelte';
	import OwnImage from '$lib/landing/OwnImage.svelte';
	import { LANGS, TERMS_URL, texts } from '$lib/landing/i18n.js';
	import { BACKUP_YEAR_CENTS, CREDITS_URL, PLANS, backupMonthCredits, creditsCatalog } from '$lib/credits.js';
	import Trust from '$lib/landing/Trust.svelte';
	import BuildLine from '$lib/landing/BuildLine.svelte';

	const APP = '/app/';
	/** @type {{ lang: 'de' | 'en' }} */
	let { lang } = $props();
	// Link previews need absolute addresses.
	const SITE = 'https://paperless.le-space.de/';
	// Where each language lives; what the language links point at.
	const PATHS = { de: '/', en: '/en/' };
	const URLS = { de: SITE, en: `${SITE}en/` };
	// Bump ?v= when an image changes: platforms cache previews by URL.
	const OG_IMAGES = { de: `${SITE}og.png?v=4`, en: `${SITE}og-en.png?v=1` };
	const OG_IMAGE = $derived(OG_IMAGES[lang]);
	const t = $derived(texts[lang]);
	let plans = $state(PLANS);

	// The page someone is on is the language they chose: the licence page and
	// the app's way back read it.
	function remember(/** @type {'de' | 'en'} */ l) {
		try {
			localStorage.setItem('paperless-lang', l);
		} catch {
			/* not remembered */
		}
	}

	// After a change of page inside the site the shell's <html lang> follows.
	$effect(() => {
		document.documentElement.lang = lang;
	});

	// Le Space Credits: 100 credits are 1 €.
	const backup = $derived(backupMonthCredits(plans));
	// The year of keeping has one price, named in the terms (§ 7).
	const backupYear = BACKUP_YEAR_CENTS;
	const euro = (credits) => new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR', maximumFractionDigits: credits % 100 ? 2 : 0 }).format(credits / 100);

	onMount(() => {
		remember(lang);
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
	<link rel="canonical" href={URLS[lang]} />
	<link rel="alternate" hreflang="de" href={URLS.de} />
	<link rel="alternate" hreflang="en" href={URLS.en} />
	<link rel="alternate" hreflang="x-default" href={URLS.de} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Paperless anywhere" />
	<meta property="og:url" content={URLS[lang]} />
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
	<!-- Not a link: this is the home page, and the line below links to Paperless-ngx,
	     its first mention on the page. -->
	<div class="brand" data-testid="brand">
		<Logo size={34}>{#snippet sub()}<NgxText text={t.tagline} link />{/snippet}</Logo>
	</div>
	<nav aria-label="Sections">
		<a href="#how">{t.nav.how}</a>
		<a href="#tee">{t.nav.tee}</a>
		<a href="#nodes">{t.nav.nodes}</a>
		<a href="#storage">{t.nav.storage}</a>
		<a href="#trust">{t.nav.trust}</a>
		<a href="#prices">{t.nav.prices}</a>
		<a href="#faq">{t.nav.faq}</a>
	</nav>
	<div class="langs" role="group" aria-label="Language">
		<!-- Real links: each language has its own address. -->
		{#each LANGS as l}
			<a class="lang" class:on={lang === l} href={PATHS[l]} hreflang={l} lang={l} aria-current={lang === l ? 'page' : undefined} onclick={() => remember(l)} data-testid={`lang-${l}`}>{l.toUpperCase()}</a>
		{/each}
	</div>
</header>

<main>
	<section class="hero">
		<p class="kicker data">{t.hero.kicker}</p>
		<!-- One sentence, one changing word. A screen reader gets the sentence with
		     all three words and no announcement of the change; the changing part is
		     decoration to it. CSS only: three turns, then it stands still on the
		     first word, and with reduced motion it stands from the start. -->
		<h1 aria-label={t.hero.full} data-testid="hero-title">
			<span aria-hidden="true">{t.hero.before}
				<span class="swap">{#each t.hero.words as w, i}<span class="word w{i}">{w}</span>{' '}{/each}</span>
			</span>
		</h1>
		<p class="lead">{t.hero.lead}</p>
		<p class="actions"><a class="cta" href={APP}>{t.open} →</a><span class="hint">{t.openHint}</span></p>
		<p class="disclaimer" data-testid="hero-disclaimer">{t.disclaimer}</p>
		<ul class="points">
			{#each t.points as p}<li><h3>{p.t}</h3><p>{p.d}</p></li>{/each}
		</ul>
		<p class="trust-hint"><a href="#trust" data-testid="trust-hint">{t.trustHint} →</a></p>
	</section>

	<section id="audience">
		<h2>{t.audience.title}</h2>
		<p class="lead">{t.audience.lead}</p>
		<ul class="audience" data-testid="audience">
			{#each t.audience.items as item}<li><strong>{item.who}</strong> {item.what}</li>{/each}
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
		<TeeNodes t={t.nodes} {lang} />
		<p>{t.nodes.storageNote}</p>
		<p class="depends" data-testid="nodes-depends">{t.nodes.dependsNote}</p>
	</section>

	<section id="storage">
		<h2>{t.storage.title}</h2>
		<p class="lead">{t.storage.lead}</p>
		<p>{t.storage.choose}</p>
		<StorageProviders t={t.storage} {lang} />
	</section>

	<section id="trust">
		<h2>{t.trust.title}</h2>
		<!-- The claim never stands alone: what is not confirmed yet is one click below it. -->
		<p class="claim-sub" data-testid="trust-sub">{t.trust.sub} · <a href="#trust-open">{t.trust.gapsTitle} ↓</a></p>
		<p class="lead">{t.trust.lead}</p>
		<Trust t={t.trust} {lang} />
	</section>

	<section id="image">
		<h2>{t.ownImage.title}</h2>
		<p class="lead">{t.ownImage.lead}</p>
		<OwnImage t={t.ownImage} />
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
		<p class="vat" data-testid="prices-vat">{t.prices.vat}</p>
		<p class="included" data-testid="prices-included">{t.prices.included}</p>
		<!-- The backup is a price of its own (terms § 7), read from the service's list. -->
		<p data-testid="prices-backup"><strong>{t.prices.backup(euro(backup))}</strong> {t.prices.backupNeed}</p>
		<p data-testid="prices-backup-year">{t.prices.backupYear(euro(backupYear))}</p>
		{#if plans[0]}<p data-testid="prices-backup-total">{t.prices.backupTotal(t.prices.hours(plans[0].hours), euro(plans[0].priceCredits), euro(backup), euro(plans[0].priceCredits + backup))}</p>{/if}
		<p class="legal" data-testid="prices-backup-after">{t.prices.backupAfter}</p>
		<p>{t.prices.example}</p>
		<p class="legal" data-testid="prices-legal">{t.prices.legal.before}<a href={TERMS_URL}>{t.prices.legal.terms}</a>{t.prices.legal.between}<a href={TERMS_URL}>{t.prices.legal.withdrawal}</a>{t.prices.legal.after}</p>
	</section>

	<section id="faq">
		<h2>{t.faq.title}</h2>
		<div class="faq">
			{#each t.faq.items as item, i}
				<details open={i === 0}>
					<summary>{item.q}</summary>
					<p>{item.a}</p>
					{#if item.tips}<ul>{#each item.tips as tip}<li>{tip}</li>{/each}</ul>{/if}
					{#if item.after}<p>{item.after}</p>{/if}
					{#if item.more}<p><a href={item.more.href} rel="noopener">{item.more.text}</a></p>{/if}
				</details>
			{/each}
		</div>
	</section>

	<section class="closing">
		<h2>{t.cta.title}</h2>
		<p>{t.cta.lead}</p>
		<p class="actions"><a class="cta" href={APP}>{t.open} →</a></p>
	</section>
</main>

<footer>
	<p class="built">{t.footer.built}</p>
	<p class="built" data-testid="footer-disclaimer">{t.disclaimer} <a href={NGX_URL}>{t.footer.ngxLink}</a></p>
	<span>{t.footer.by}</span>
	<a href="https://www.belege.le-space.de">{t.footer.belege}</a>
	<a href="https://le-space.de/">le-space.de</a>
	<a href={t.footer.imprintUrl}>{t.footer.imprint}</a>
	<a href={t.footer.privacyUrl}>{t.footer.privacy}</a>
	<a href={TERMS_URL} data-testid="footer-terms">{t.footer.terms}</a>
	<a href={TERMS_URL} data-testid="footer-withdrawal">{t.footer.withdrawal}</a>
	<a href="/lizenzen/">{t.licences.link}</a>
	<BuildLine {lang} t={t.footer.build} />
</footer>

<style>
	.top, main, footer { max-width: 1040px; margin: 0 auto; padding: 0 var(--gutter); }
	.top { display: flex; align-items: center; gap: 1.25rem; padding-top: 1.25rem; padding-bottom: 1.25rem; }
	/* Where the section links show, the header stays at the top while the page
	   scrolls, so they are always at hand. Its background reaches the window's
	   edges although the header itself is as wide as the text. */
	@media (min-width: 981px) {
		.top { position: sticky; top: 0; z-index: 10; padding-top: 0.75rem; padding-bottom: 0.75rem; background: var(--bg); box-shadow: 0 0 0 100vmax var(--bg), 0 1px 0 100vmax var(--line); clip-path: inset(0 -100vmax -1px); }
	}
	.brand { min-width: 0; }
	nav { display: flex; gap: 0.95rem; margin-left: auto; font-size: 0.9rem; }
	/* Beside the section links the line under the logo stays on one line. */
	@media (min-width: 981px) {
		.top :global(.logo) { flex: none; }
		.top :global(.logo .sub) { white-space: nowrap; }
	}
	nav a { color: var(--text-2); text-decoration: none; white-space: nowrap; }
	nav a:hover { color: var(--text); }
	.langs { display: flex; gap: 0.25rem; }
	.lang { font-family: var(--mono); font-size: 0.75rem; padding: 0.25rem 0.55rem; background: transparent; color: var(--text-2); border: 1px solid var(--line); border-radius: 999px; text-decoration: none; }
	.lang.on { background: var(--cta-bg); color: var(--cta-text); border-color: var(--cta-bg); }

	section { padding: 3.5rem 0 1rem; scroll-margin-top: 1rem; }
	/* Below the header that stays at the top: a section a link jumps to begins
	   under it otherwise. */
	@media (min-width: 981px) {
		/* Up to 108 px of header where the name wraps to two lines. */
		section { scroll-margin-top: 7.25rem; }
	}
	h2 { font-size: 1.75rem; margin: 0 0 0.75rem; }
	.included { font-weight: 600; }
	.trust-hint { margin: 1.25rem 0 0; font-size: 0.95rem; }
	.vat { margin: 0.75rem 0 0; font-weight: 600; }
	.legal, .depends { color: var(--text-2); font-size: 0.9rem; }
	.lead { font-size: 1.1rem; color: var(--text-2); max-width: 46rem; }
	.claim-sub { margin: -0.25rem 0 0.75rem; font-weight: 600; }
	.claim-sub a { font-weight: 400; }
	.audience { max-width: 46rem; margin: 0.75rem 0 0; padding-left: 1.2rem; color: var(--text-2); display: grid; gap: 0.5rem; }
	.audience strong { color: var(--text); }

	.hero { padding-top: 3rem; }
	.kicker { color: var(--accent-text); text-transform: uppercase; letter-spacing: 0.12em; margin: 0 0 1rem; }
	h1 { font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 1.25rem; max-width: 22ch; }
	/* The three words lie on top of each other in one cell, which is as wide and
	   as high as the largest: the line below never moves when the word changes. */
	.swap { display: grid; }
	.word { grid-area: 1 / 1; color: var(--accent-text); opacity: 0; }
	.w0 { opacity: 1; }
	@media (min-width: 600px) {
		.word { white-space: nowrap; }
	}
	@media (prefers-reduced-motion: no-preference) {
		.w0 { animation: word-first 9s ease-in-out 3 both; }
		.w1 { animation: word-second 9s ease-in-out 3 both; }
		.w2 { animation: word-third 9s ease-in-out 3 both; }
	}
	/* One turn is nine seconds, three for each word. The first is there at the
	   start and at the end of a turn, so the turns join and the last one ends on it. */
	@keyframes word-first { 0%, 28% { opacity: 1; } 33%, 95% { opacity: 0; } 100% { opacity: 1; } }
	@keyframes word-second { 0%, 33% { opacity: 0; } 38%, 61% { opacity: 1; } 66%, 100% { opacity: 0; } }
	@keyframes word-third { 0%, 66% { opacity: 0; } 71%, 95% { opacity: 1; } 100% { opacity: 0; } }
	.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1rem; margin: 2rem 0; }
	.cta { display: inline-block; padding: 0.85rem 1.5rem; border-radius: 999px; background: var(--cta-bg); color: var(--cta-text); font-weight: 600; text-decoration: none; }
	.cta:hover { filter: brightness(1.08); }
	.hint { color: var(--text-2); font-size: 0.9rem; }
	.disclaimer { color: var(--text-2); font-size: 0.8rem; max-width: 46rem; margin: -1.25rem 0 2rem; }

	.faq { display: grid; gap: 0.6rem; max-width: 46rem; }
	.faq details { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 0.9rem 1.1rem; }
	.faq summary { font-weight: 600; cursor: pointer; }
	.faq p { margin: 0.6rem 0 0; color: var(--text-2); }
	.faq ul { margin: 0.5rem 0 0; padding-left: 1.2rem; color: var(--text-2); }
	.faq li { margin: 0.25rem 0; }

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

	@media (max-width: 980px) {
		nav { display: none; }
		.langs { margin-left: auto; }
	}
</style>
