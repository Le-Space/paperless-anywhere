<script>
	// The first start with an image of one's own, as an event of its own: a
	// full-screen view with six stations (the build, then the start), the
	// time left and when it ends, from the click until Paperless runs, about
	// 25 minutes. It can shrink to a slim bar above the app. While it runs the
	// screen stays on (Wake Lock), leaving the page asks first, and the tab's
	// title carries the progress. At the end: "Geschafft" and the certificate.
	import { onDestroy } from 'svelte';
	import ImageCertificate from '$lib/ImageCertificate.svelte';
	import { journey, STATIONS } from '$lib/first-start.js';
	import { format, lang, t } from '$lib/i18n/index.js';

	/**
	 * @type {{
	 *   view: { station: string, since: number, fetchPct: number | null, done: boolean, failed: boolean, minimized: boolean, certificate: boolean },
	 *   startTypical: number,
	 *   host?: string | null,
	 *   ownImage?: any,
	 *   imageHash?: string | null,
	 *   plain?: any,
	 *   onminimize: () => void,
	 *   onexpand: () => void,
	 *   oncertificate: (show: boolean) => void,
	 *   onclose: () => void
	 * }}
	 */
	let { view, startTypical, host = null, ownImage = null, imageHash = null, plain = null, onminimize, onexpand, oncertificate, onclose } = $props();

	const x = $derived($t.first);
	let now = $state(Date.now());
	const tick = setInterval(() => (now = Date.now()), 1000);
	onDestroy(() => clearInterval(tick));

	const j = $derived(journey({ station: view.station, since: view.since, now, fetchPct: view.fetchPct, startTypical, done: view.done }));
	const pct = $derived(Math.round(j.share * 100));
	const here = $derived(/** @type {any} */ (x.stations)[view.station] ?? x.stations.wake);
	const stations = $derived(STATIONS.map((s, i) => ({ key: s.key, n: i + 1, ...(/** @type {any} */ (x.stations)[s.key]), done: view.done || i < j.index, active: !view.done && i === j.index })));
	const ends = $derived(new Date(j.ends).toLocaleTimeString($lang === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }));
	const running = $derived(!view.done && !view.failed);

	// The screen stays on while it runs, and comes back on after the tab was hidden.
	/** @type {any} */
	let lock = null;
	async function wake() {
		try {
			lock = (await /** @type {any} */ (navigator).wakeLock?.request('screen')) ?? null;
		} catch {
			lock = null;
		}
	}
	$effect(() => {
		if (!running) return;
		wake();
		const visible = () => document.visibilityState === 'visible' && wake();
		document.addEventListener('visibilitychange', visible);
		return () => {
			document.removeEventListener('visibilitychange', visible);
			lock?.release?.().catch?.(() => {});
			lock = null;
		};
	});
	// Leaving the page would stop the build: the browser asks first.
	$effect(() => {
		if (!running) return;
		const ask = (/** @type {BeforeUnloadEvent} */ e) => {
			e.preventDefault();
			e.returnValue = x.leave;
			return x.leave;
		};
		window.addEventListener('beforeunload', ask);
		return () => window.removeEventListener('beforeunload', ask);
	});
	// The tab's title carries the progress, and gets its own back afterwards.
	const before = typeof document === 'undefined' ? '' : document.title;
	$effect(() => {
		if (running) document.title = x.tab(pct);
		else document.title = before;
	});
	onDestroy(() => {
		if (typeof document !== 'undefined') document.title = before;
	});
</script>

{#if view.minimized && running}
	<div class="mini" role="status" data-testid="first-mini">
		<span class="dot pulse" aria-hidden="true"></span>
		<strong>{here.mini}</strong>
		<span class="bar"><span class="fill shimmer" style="width: {pct}%"></span></span>
		<span>{pct} % · {x.left(j.left)}</span>
		<button type="button" onclick={onexpand} data-testid="first-expand">{x.expand}</button>
	</div>
{:else}
	<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="first-title" data-testid="first-start">
		{#if view.certificate && ownImage && imageHash}
			<ImageCertificate {ownImage} {imageHash} {plain} onDark onback={() => oncertificate(false)} />
		{:else if view.done}
			<div class="finale" data-testid="first-done">
				<div class="big pop" aria-hidden="true">
					<span class="spark s1"></span><span class="spark s2"></span><span class="spark s3"></span><span class="spark s4"></span>
					<span class="ring spin"></span>
					<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
				</div>
				<h2 id="first-title">{x.doneTitle}</h2>
				<p>{x.doneText}</p>
				<p class="row">
					{#if host}<a class="cta" href={`https://${host}`} target="_blank" rel="noopener noreferrer" data-testid="first-open">{x.open}</a>{/if}
					{#if ownImage && imageHash}<button type="button" class="secondary" onclick={() => oncertificate(true)} data-testid="first-certificate">{x.showCertificate}</button>{/if}
					<button type="button" class="link" onclick={onclose} data-testid="first-close">{x.close}</button>
				</p>
			</div>
		{:else}
			<div class="journey">
				<div class="top">
					<div>
						<p class="kicker">{x.kicker}</p>
						<h2 id="first-title">{x.title}</h2>
					</div>
					{#if running}<button type="button" class="ghost" onclick={onminimize} data-testid="first-minimize">{x.minimize}</button>
					{:else}<button type="button" class="ghost" onclick={onclose} data-testid="first-close">{x.close}</button>{/if}
				</div>
				<ol class="stations">
					{#each stations as s (s.key)}
						<li class:done={s.done} class:active={s.active} aria-current={s.active ? 'step' : undefined} data-testid={`station-${s.key}`}>
							<span class="circle" class:pulse={s.active && running}>
								{#if s.done}<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
								{:else}{s.n}{/if}
								{#if s.active && running}<span class="ring spin" aria-hidden="true"></span>{/if}
							</span>
							<span class="label">{s.label}</span>
							<span class="dur">{s.duration}</span>
						</li>
					{/each}
				</ol>
				<div class="now" aria-live="polite">
					<p class="step">{x.step(j.index + 1)} · {here.duration}</p>
					{#if view.failed}
						<h3>{x.pausedTitle}</h3>
						<p>{x.pausedText}</p>
					{:else}
						<h3 data-testid="first-stage">{here.title}</h3>
						<p>{here.text}</p>
						{#if j.index > 1}<p class="proof pop"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"></path><path d="M9 12l2 2 4-4"></path></svg>{x.measured}</p>{/if}
						{#if view.station === 'fetch' && view.fetchPct != null}
							<span class="bar big-bar"><span class="fill gold shimmer" style="width: {view.fetchPct}%"></span></span>
							<p class="small" data-testid="first-fetch">{x.fetched(view.fetchPct)}</p>
						{/if}
					{/if}
				</div>
				<div class="total">
					<p class="row between"><strong data-testid="first-share">{x.share(pct)}</strong><span>{x.left(j.left)} · {x.endsAt(ends)}</span></p>
					<span class="bar"><span class="fill shimmer" style="width: {pct}%"></span></span>
					<p class="small">{x.keepOpen}</p>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.overlay { position: fixed; inset: 0; z-index: 50; overflow-y: auto; background: #0f2a2e; color: #f6f2ea; display: flex; justify-content: center; align-items: flex-start; padding: clamp(1rem, 4vw, 3rem) 1rem; }
	.journey, .finale { width: 100%; max-width: 68rem; display: flex; flex-direction: column; gap: 2rem; }
	.top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 1rem; }
	.kicker { margin: 0; font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: #5eead4; }
	h2 { margin: 0.4rem 0 0; font-size: clamp(1.8rem, 4vw, 2.6rem); line-height: 1.1; }
	h3 { margin: 0; font-size: clamp(1.4rem, 3vw, 1.9rem); }
	.ghost { padding: 0.6rem 1.1rem; border-radius: 999px; border: 1px solid rgba(246, 242, 234, 0.35); background: transparent; color: inherit; cursor: pointer; }
	.stations { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.75rem; }
	@media (max-width: 720px) { .stations { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 1.25rem; } }
	.stations li { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; text-align: center; }
	.circle { position: relative; width: 4rem; height: 4rem; border-radius: 50%; border: 2px solid rgba(246, 242, 234, 0.25); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.2rem; color: rgba(246, 242, 234, 0.65); }
	.active .circle { background: #f6f2ea; color: #0f2a2e; border-color: #f6f2ea; }
	.done .circle { background: #0f766e; border-color: #0f766e; color: #f6f2ea; animation: pop 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
	.ring { position: absolute; inset: -7px; border-radius: 50%; border: 2px dashed #5eead4; }
	.label { font-weight: 600; }
	.dur { font-size: 0.8rem; color: rgba(246, 242, 234, 0.7); }
	.now { background: rgba(246, 242, 234, 0.06); border: 1px solid rgba(246, 242, 234, 0.14); border-radius: 20px; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
	.now p { margin: 0; line-height: 1.55; max-width: 48rem; color: rgba(246, 242, 234, 0.9); }
	.step { font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: #f5c76b !important; }
	.proof { display: inline-flex; align-items: center; gap: 0.5rem; width: fit-content; padding: 0.4rem 0.8rem; border-radius: 10px; background: rgba(94, 234, 212, 0.12); color: #5eead4 !important; }
	.total { display: flex; flex-direction: column; gap: 0.6rem; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin: 0; }
	.between { justify-content: space-between; }
	.small { margin: 0; font-size: 0.85rem; color: rgba(246, 242, 234, 0.72); }
	.bar { display: block; height: 10px; border-radius: 999px; background: rgba(246, 242, 234, 0.15); overflow: hidden; }
	.big-bar { height: 14px; max-width: 48rem; }
	.fill { display: block; height: 100%; border-radius: 999px; background-color: #5eead4; transition: width 1s ease; }
	.fill.gold { background-color: #f5c76b; }
	.finale { align-items: center; text-align: center; max-width: 44rem; padding-top: 3rem; }
	.finale p { margin: 0; line-height: 1.55; color: rgba(246, 242, 234, 0.9); }
	.big { position: relative; width: 7rem; height: 7rem; border-radius: 50%; background: #0f766e; display: flex; align-items: center; justify-content: center; color: #fff; }
	.big .ring { inset: -10px; border: 3px dashed #f5c76b; }
	.cta { padding: 0.8rem 1.5rem; border-radius: 999px; background: #f6f2ea; color: #0f2a2e; font-weight: 600; text-decoration: none; }
	.secondary { padding: 0.8rem 1.5rem; border-radius: 999px; border: 1px solid #f6f2ea; background: transparent; color: #f6f2ea; font-weight: 600; cursor: pointer; }
	.link { background: none; border: none; color: rgba(246, 242, 234, 0.8); text-decoration: underline; cursor: pointer; }
	.mini { position: sticky; top: 0; z-index: 40; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1rem; padding: 0.7rem 1.25rem; background: #0f3d3a; color: #f6f2ea; }
	.mini .bar { flex: 1 1 10rem; height: 6px; min-width: 6rem; }
	.mini button { padding: 0.4rem 0.9rem; border-radius: 999px; border: 1px solid #5eead4; background: transparent; color: inherit; cursor: pointer; }
	.dot { width: 0.75rem; height: 0.75rem; border-radius: 50%; background: #5eead4; }
	.spark { position: absolute; width: 8px; height: 8px; border-radius: 2px; bottom: 0; animation: rise 2.4s ease-out infinite; }
	.s1 { left: -2.5rem; background: #5eead4; } .s2 { left: 1rem; background: #f5c76b; animation-delay: 0.5s; } .s3 { right: 1rem; background: #5eead4; animation-delay: 1s; } .s4 { right: -2.5rem; background: #f5c76b; animation-delay: 1.5s; }
	.pulse { animation: pulse 1.8s ease-out infinite; }
	.spin { animation: spin 6s linear infinite; }
	.pop { animation: pop 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
	.shimmer { background-image: linear-gradient(90deg, rgba(255, 255, 255, 0) 0, rgba(255, 255, 255, 0.45) 50%, rgba(255, 255, 255, 0) 100%); background-size: 200px 100%; background-repeat: no-repeat; animation: shimmer 1.6s linear infinite; }
	@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(94, 234, 212, 0.5); } 70% { box-shadow: 0 0 0 18px rgba(94, 234, 212, 0); } 100% { box-shadow: 0 0 0 0 rgba(94, 234, 212, 0); } }
	@keyframes spin { to { transform: rotate(360deg); } }
	@keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
	@keyframes shimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
	@keyframes rise { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-140px); opacity: 0; } }
	@media (prefers-reduced-motion: reduce) {
		.pulse, .spin, .pop, .shimmer, .done .circle { animation: none; }
		.spark { display: none; }
		.fill { transition: none; }
	}
	@media print { .overlay { position: static; background: none; color: inherit; padding: 0; } }
</style>
