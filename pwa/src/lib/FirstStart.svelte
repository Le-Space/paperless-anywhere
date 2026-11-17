<script>
	// The first start with an image of one's own, as an event of its own: a
	// full-screen view with six stations (the build, then the start), the
	// time left and when it ends, from the click until Paperless runs, about
	// 25 minutes. It can shrink to a slim bar above the app. While it runs the
	// screen stays on (Wake Lock), leaving the page asks first, and the tab's
	// title carries the progress. At the end: "Geschafft" and the certificate.
	import { onDestroy } from 'svelte';
	import ImageCertificate from '$lib/ImageCertificate.svelte';
	import { evidence, fetchRate, flowNow, HARDWARE, journey, STATIONS, substeps } from '$lib/first-start.js';
	import { ALEPH_MESSAGE, BUILDER, REPOSITORY, UPLOAD_HOSTS } from '$lib/own-image.js';
	import { format, lang, t } from '$lib/i18n/index.js';

	/**
	 * @type {{
	 *   view: { station: string, since: number, fetchPct: number | null, done: boolean, failed: boolean, minimized: boolean, certificate: boolean, rebuild?: boolean, facts?: import('$lib/first-start.js').Facts },
	 *   startTypical: number,
	 *   host?: string | null,
	 *   ownImage?: any,
	 *   imageHash?: string | null,
	 *   plain?: any,
	 *   texts?: typeof import('$lib/i18n/first-start.js').first.de | null,
	 *   simple?: boolean,
	 *   onminimize: () => void,
	 *   onexpand: () => void,
	 *   oncertificate: (show: boolean) => void,
	 *   onclose: () => void
	 * }}
	 */
	let { view, startTypical, host = null, ownImage = null, imageHash = null, plain = null, texts = null, simple = false, onminimize, onexpand, oncertificate, onclose } = $props();

	// `texts`: other words for the same journey (v0.2's "Standard" speaks plainly);
	// `simple`: without the small steps and the evidence, which stay in the technical view.
	const x = $derived(texts ?? $t.first);
	let now = $state(Date.now());
	const tick = setInterval(() => (now = Date.now()), 1000);
	onDestroy(() => clearInterval(tick));

	// A rebuild of the image ends with the build: no Paperless station.
	const shown = $derived(view.rebuild ? STATIONS.filter((s) => s.key !== 'paperless') : STATIONS);
	// The fetch at its measured speed, once known; the rest at the typical times.
	const fetchLeft = $derived.by(() => {
		const f = view.facts ?? {};
		const r = view.station === 'fetch' ? fetchRate(f, now) : null;
		return r && f.size && f.got != null ? (f.size - f.got) / 1048576 / r : null;
	});
	const j = $derived(journey({ station: view.station, since: view.since, now, fetchPct: view.fetchPct, startTypical: view.rebuild ? 0 : startTypical, done: view.done, hereLeft: fetchLeft }));
	const pct = $derived(Math.round(j.share * 100));
	const here = $derived(/** @type {any} */ (x.stations)[view.station] ?? x.stations.wake);
	const stations = $derived(shown.map((s, i) => ({ key: s.key, n: i + 1, ...(/** @type {any} */ (x.stations)[s.key]), done: view.done || i < j.index, active: !view.done && i === j.index })));
	const ends = $derived(new Date(j.ends).toLocaleTimeString($lang === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }));
	const running = $derived(!view.done && !view.failed);
	// What was reported on the way (first-start.js): small steps, the flow, the evidence.
	const facts = $derived(view.facts ?? {});
	const steps = $derived(substeps(view.station, view.station, facts, view.done));
	const flow = $derived(flowNow(view.station, facts, view.fetchPct));
	const rate = $derived(fetchRate(facts, now));
	const proofs = $derived(evidence(facts, BUILDER, { aleph: ALEPH_MESSAGE, repo: REPOSITORY }));
	const short = (/** @type {string} */ v) => (v.length > 20 ? `${v.slice(0, 10)}…${v.slice(-6)}` : v);
	const mib = (/** @type {number} */ b) => Math.round(b / 1048576);
	// The picture: where each place sits, and the path the data takes now.
	/** @type {Record<string, [number, number]>} */
	const AT = { browser: [90, 120], relay: [360, 44], node: [630, 120], aleph: [360, 196], filecoin: [630, 210] };
	const LINKS = [['browser', 'relay'], ['relay', 'node'], ['browser', 'aleph'], ['aleph', 'node'], ['filecoin', 'node']];
	const pathD = $derived(flow.path.map((k, i) => `${i ? 'L' : 'M'}${AT[k][0]} ${AT[k][1]}`).join(' '));
	const onPath = (/** @type {string} */ a, /** @type {string} */ b) => flow.path.some((k, i) => i > 0 && ((flow.path[i - 1] === a && k === b) || (flow.path[i - 1] === b && k === a)));

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
				<h2 id="first-title">{view.rebuild ? x.rebuildDoneTitle : x.doneTitle}</h2>
				<p>{view.rebuild ? x.rebuildDoneText : x.doneText}</p>
				<p class="row">
					{#if host && !view.rebuild}<a class="cta" href={`https://${host}`} target="_blank" rel="noopener noreferrer" data-testid="first-open">{x.open}</a>{/if}
					{#if ownImage && imageHash}<button type="button" class="secondary" onclick={() => oncertificate(true)} data-testid="first-certificate">{x.showCertificate}</button>{/if}
					<button type="button" class="link" onclick={onclose} data-testid="first-close">{x.close}</button>
				</p>
			</div>
		{:else}
			<div class="journey">
				<div class="top">
					<div>
						<p class="kicker">{view.rebuild ? x.rebuildKicker : x.kicker}</p>
						<h2 id="first-title">{view.rebuild ? x.rebuildTitle : x.title}</h2>
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
				<div class="leds" aria-hidden="true">{#each stations as s (s.key)}<span class="led" class:on={s.done} class:blink={s.active && running}></span>{/each}</div>
				<div class="grid">
					<div class="col">
						<div class="now" aria-live="polite">
							<p class="step">{x.step(j.index + 1, shown.length)} · {here.duration}</p>
							{#if view.failed}
								<h3>{x.pausedTitle}</h3>
								<p>{x.pausedText}</p>
							{:else}
								<h3 data-testid="first-stage">{here.title}</h3>
								<p>{here.text}</p>
								<ul class="subs" hidden={simple} data-testid="first-substeps">
									{#each steps as st (st.key)}
										<li class={st.state}><span class="led" class:on={st.state === 'done'} class:blink={st.state === 'active' && running} aria-hidden="true"></span><span>{/** @type {any} */ (x.sub)[st.key]}{#if st.key === 'lanes' && facts.attested}{' · '}<small>{x.attestedCount(facts.attested)}</small>{/if}{#if st.key === 'bytes' && facts.size}{' · '}<small>{x.mib(mib(facts.got ?? 0), mib(facts.size))}{#if rate}{' · '}{x.rate(rate.toFixed(1))}{/if}</small>{/if}{#if st.key === 'upload' && facts.host && view.station === 'store'}{' · '}<small data-testid="first-upload">{#if (facts.attempt ?? 1) > 1}{x.attempt(facts.attempt ?? 1, UPLOAD_HOSTS.length)}{' · '}{/if}{String(facts.host).replace(/^https?:\/\//, '')}</small>{/if}</span></li>
									{/each}
								</ul>
								{#if view.station === 'store' && (facts.attempt ?? 1) > 1 && !facts.processed}<p class="small retry" data-testid="first-retry">{x.retryNote}</p>{/if}
								{#if view.station === 'fetch' && view.fetchPct != null}
									<span class="bar big-bar"><span class="fill gold shimmer" style="width: {view.fetchPct}%"></span></span>
									<p class="small" data-testid="first-fetch">{x.fetched(view.fetchPct)}</p>
								{/if}
							{/if}
						</div>
						{#if running}
							<figure class="flow" data-testid="first-flow">
								<figcaption>{x.flowTitle}: <strong>{/** @type {any} */ (x.flow)[flow.what]}</strong>{#if flow.share != null} · {Math.round(flow.share * 100)} %{/if}</figcaption>
								<svg viewBox="0 0 720 250" role="img" aria-label={`${x.flowTitle}: ${/** @type {any} */ (x.flow)[flow.what]}`}>
									{#each LINKS as [a, b] (a + b)}
										<line x1={AT[a][0]} y1={AT[a][1]} x2={AT[b][0]} y2={AT[b][1]} class:hot={onPath(a, b)} />
									{/each}
									<path d={pathD} class="route" />
									{#each [0, 0.6, 1.2] as delay (delay)}
										<circle r="6" class="packet" opacity="0"><set attributeName="opacity" to="1" begin={`${delay}s`} /><animateMotion dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" path={pathD} /></circle>
									{/each}
									{#each Object.entries(AT) as [k, [cx, cy]] (k)}
										<g class="place" class:hot={flow.path.includes(k)}>
											<rect x={cx - 82} y={cy - 18} width="164" height="36" rx="10" />
											<circle cx={cx - 66} cy={cy} r="5" class="lamp" class:blink={flow.path.includes(k)} />
											<text x={cx - 54} y={cy + 5}>{/** @type {any} */ (x.nodes)[k]}</text>
										</g>
									{/each}
								</svg>
								{#if flow.share != null}<span class="bar"><span class="fill" style="width: {Math.round(flow.share * 100)}%"></span></span>{/if}
							</figure>
						{/if}
					</div>
					<aside class="proofs" hidden={simple} data-testid="first-evidence">
						<h4>{x.evidenceTitle}</h4>
						<ul>
							{#each proofs as p (p.key)}
								<li class="pop">
									<span class="led on" aria-hidden="true"></span>
									<span class="what">{/** @type {any} */ (x.evidence)[p.key]}{#if p.ok}{' · '}<em>{x.matches}</em>{/if}</span>
									{#if p.href}<a href={p.href} target="_blank" rel="noopener noreferrer"><code>{short(p.value)}</code></a>{:else}<code>{short(p.value)}</code>{/if}
								</li>
							{/each}
						</ul>
						<h4>{x.hardwareTitle}</h4>
						<ul>
							{#each HARDWARE as h (h.key)}<li><span class="led on" aria-hidden="true"></span><a href={h.href} target="_blank" rel="noopener noreferrer">{/** @type {any} */ (x.hardware)[h.key]}</a></li>{/each}
						</ul>
					</aside>
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
	.leds { display: flex; gap: 0.5rem; justify-content: center; }
	.led { display: inline-block; flex: none; width: 0.6rem; height: 0.6rem; border-radius: 50%; background: rgba(246, 242, 234, 0.2); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25); }
	.led.on { background: #34d399; box-shadow: 0 0 8px #34d399; }
	.led.blink { background: #f5c76b; box-shadow: 0 0 10px #f5c76b; animation: blink 0.9s steps(2, start) infinite; }
	.grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 1.25rem; align-items: start; }
	@media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
	.col { display: flex; flex-direction: column; gap: 1.25rem; min-width: 0; }
	.subs { list-style: none; margin: 0.25rem 0 0; padding: 0; display: grid; gap: 0.45rem; }
	.subs li { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 0.6rem; align-items: baseline; color: rgba(246, 242, 234, 0.9); }
	.subs li.next { color: rgba(246, 242, 234, 0.5); }
	.subs small { color: #f5c76b; }
	.flow { margin: 0; background: rgba(246, 242, 234, 0.04); border: 1px solid rgba(246, 242, 234, 0.12); border-radius: 20px; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
	.flow figcaption { font-size: 0.9rem; color: rgba(246, 242, 234, 0.85); }
	.flow svg { width: 100%; height: auto; }
	.flow line { stroke: rgba(246, 242, 234, 0.15); stroke-width: 2; stroke-dasharray: 4 6; }
	.flow line.hot { stroke: rgba(94, 234, 212, 0.55); stroke-dasharray: none; }
	.flow .route { fill: none; stroke: none; }
	.flow .packet { fill: #f5c76b; filter: drop-shadow(0 0 4px #f5c76b); }
	.place rect { fill: #133a3f; stroke: rgba(246, 242, 234, 0.2); }
	.place.hot rect { stroke: #5eead4; }
	.place text { fill: #f6f2ea; font-size: 13px; font-weight: 600; }
	.lamp { fill: rgba(246, 242, 234, 0.25); }
	.lamp.blink { fill: #34d399; animation: blink 0.9s steps(2, start) infinite; }
	.proofs { background: rgba(246, 242, 234, 0.04); border: 1px solid rgba(246, 242, 234, 0.12); border-radius: 20px; padding: 1.1rem 1.25rem; min-width: 0; }
	.proofs h4 { margin: 0 0 0.6rem; font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: #5eead4; }
	.proofs h4 + ul + h4 { margin-top: 1rem; }
	.proofs ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
	.proofs li { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 0.55rem; align-items: baseline; font-size: 0.85rem; }
	.proofs li .led { align-self: center; }
	.proofs li > a, .proofs li > code { grid-column: 2; }
	.proofs .what { color: rgba(246, 242, 234, 0.8); }
	.proofs em { color: #34d399; font-style: normal; font-weight: 600; }
	.proofs a { color: #5eead4; }
	.proofs code { font-family: var(--mono); font-size: 0.8rem; overflow-wrap: anywhere; }
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
	@keyframes blink { to { opacity: 0.25; } }
	@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(94, 234, 212, 0.5); } 70% { box-shadow: 0 0 0 18px rgba(94, 234, 212, 0); } 100% { box-shadow: 0 0 0 0 rgba(94, 234, 212, 0); } }
	@keyframes spin { to { transform: rotate(360deg); } }
	@keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
	@keyframes shimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
	@keyframes rise { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-140px); opacity: 0; } }
	@media (prefers-reduced-motion: reduce) {
		.pulse, .spin, .pop, .shimmer, .done .circle { animation: none; }
		.led.blink, .lamp.blink { animation: none; }
		.packet { display: none; }
		.spark { display: none; }
		.fill { transition: none; }
	}
	@media print { .overlay { position: static; background: none; color: inherit; padding: 0; } }
</style>
