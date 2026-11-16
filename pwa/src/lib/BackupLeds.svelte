<script>
	// Two lights at the top of the app (backup-status.js): "Sicherungen
	// erreichbar" and "Kopien unabhängig", in every phase and also with the
	// vault locked. A click opens what was checked: provider, place, domain,
	// state and when. The lights are for the eye; every state is also written
	// out. Checked again by themselves every few minutes while the page is
	// seen, never more often than every half minute.
	import { lang, format, t } from '$lib/i18n/index.js';
	import { untrack } from 'svelte';
	import { checkCopies, checkDue, independenceLevel, reachLevel } from '$lib/backup-status.js';

	/** @type {{ copies: { network: string, copies: { providerId: number, url?: string }[] } | null, remembered?: string, onreach?: (level: import('$lib/backup-status.js').Level) => void }} copies: the newest backup's copies (null: none known); remembered: when they were kept, while the vault is locked */
	let { copies, remembered = '', onreach = () => {} } = $props();

	const x = $derived($t.app.leds);
	/** @type {import('$lib/backup-status.js').CopyCheck | null} */
	let result = $state(null);
	let failed = $state(false);
	let checking = $state(false);
	let open = $state(/** @type {'' | 'reach' | 'independent'} */ (''));
	const key = $derived(copies ? `${copies.network}:${copies.copies.map((c) => `${c.providerId}${c.url ? '+' : ''}`).join(',')}` : '');

	/** @param {boolean} [forced] */
	async function check(forced = false) {
		if (!copies?.copies.length || checking) return;
		if (!checkDue(result?.at ?? null, Date.now(), { forced })) return;
		checking = true;
		failed = false;
		try {
			result = await checkCopies($state.snapshot(copies));
		} catch {
			failed = true;
			result = null;
		} finally {
			checking = false;
		}
	}
	// New copies: checked at once.
	$effect(() => {
		key;
		untrack(() => {
			result = null;
			failed = false;
			check();
		});
	});
	// Again every few minutes while the page is seen, and when it is seen again.
	$effect(() => {
		const tick = () => {
			if (document.visibilityState === 'visible') check();
		};
		const timer = setInterval(tick, 60_000);
		document.addEventListener('visibilitychange', tick);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', tick);
		};
	});

	const reach = $derived(reachLevel(result));
	// Only the copies at providers Le Space still uses count (blocked-providers.js).
	const independent = $derived(independenceLevel(result ? result.copies.filter((c) => !c.blocked) : null));
	$effect(() => onreach(reach));
	const time = (/** @type {Date} */ d) => format.dateTime(d.toISOString(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }, $lang);
	const short = (/** @type {string | null} */ a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '–');
	const signText = (/** @type {{ kind: 'address' | 'domain' | 'name', value: string }[]} */ signs) => signs.map((s) => $t.backup.places.signs[s.kind](s.value)).join(', ');
	const toggle = (/** @type {'reach' | 'independent'} */ which) => (open = open === which ? '' : which);
</script>

<div class="strip">
<div class="leds" role="group" aria-label={x.label} data-testid="backup-leds">
	<button class="led-button" aria-expanded={open === 'reach'} onclick={() => toggle('reach')} data-testid="led-reach" data-level={reach}>
		<i class="led {reach}" class:run={checking} aria-hidden="true"></i>{x.reach}<span class="sr">: {x.levels[reach]}</span>
	</button>
	<button class="led-button" aria-expanded={open === 'independent'} onclick={() => toggle('independent')} data-testid="led-independent" data-level={independent}>
		<i class="led {independent}" class:run={checking} aria-hidden="true"></i>{x.independent}<span class="sr">: {x.levels[independent]}</span>
	</button>
</div>

{#if open}
	<section class="details" aria-label={open === 'reach' ? x.reach : x.independent} data-testid="led-details">
		{#if !copies?.copies.length}
			<p>{x.noBackup}</p>
		{:else if failed}
			<p>{x.unreadable}</p>
		{:else if !result}
			<p>{x.checking}</p>
		{:else}
			<p class="says" data-testid="led-says">
				{#if open === 'reach'}
					{!result.total ? x.allBlocked : reach === 'ok' ? x.reachSays.ok(result.answering, result.total) : reach === 'warn' ? x.reachSays.warn(result.total) : reach === 'bad' ? x.reachSays.bad(result.total) : x.reachSays.unknown}
				{:else}
					{!result.total ? x.allBlocked : independent === 'ok' ? x.independentSays.ok(result.total) : result.total < 2 ? x.independentSays.one : x.independentSays.warn}
				{/if}
			</p>
			<ul>
				{#each result.copies as p (p.id)}
					<li data-testid={`led-provider-${p.id}`}>
						<i class="dot" class:ok={p.answers} class:blocked={Boolean(p.blocked)} aria-hidden="true"></i>
						<strong>{x.provider(p.id)} · {p.name || '?'}</strong>{p.place ? ` (${p.place})` : ''}
						— {#if p.blocked}<span data-testid={`led-blocked-${p.id}`}>{x.blocked($t.backup.places.blockedWhy[p.blocked])}</span>{:else}{p.answers ? x.answers : x.silent}{/if}
						<br /><small>{x.domain}: {p.domain ?? '–'} · {x.owner}: {short(p.payee ?? p.owner)}</small>
					</li>
				{/each}
			</ul>
			{#each result.pairs as pair}
				<p class="pair" data-testid="led-pair">{x.pair(`${pair.a.id} ${pair.a.name}`, `${pair.b.id} ${pair.b.name}`, signText(pair.signs))}</p>
			{/each}
			<p class="when">{x.checkedAt(time(result.at))}</p>
		{/if}
		{#if remembered}<p class="when">{x.fromMemory(format.dateTime(remembered, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }, $lang))}</p>{/if}
		<div class="actions">
			{#if copies?.copies.length}<button class="link" onclick={() => check(true)} disabled={checking}>{checking ? x.checking : x.again}</button>{/if}
			<button class="link" onclick={() => (open = '')}>{x.close}</button>
		</div>
	</section>
{/if}
</div>

<style>
	/* The look of the start panel's lights (StartPanel.svelte): a dark strip in both themes, its colours at least 4.5:1 on the ground. */
	.strip {
		--ground: #0b1020; --rule: #1f2947; --ink: #e6ebf8; --dim: #9aa6c6;
		--app: #5fd6a8; --run: #f5b041; --bad: #ff8a80; --off: #2a3558;
		background: var(--ground); color: var(--ink);
	}
	.leds { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; max-width: 40rem; margin: 0 auto; padding: 0.35rem var(--gutter); }
	.led-button { display: inline-flex; align-items: center; gap: 0.45rem; margin: 0; padding: 0.2rem 0; background: none; border: 0; color: var(--ink); font-family: var(--mono); font-size: 0.8rem; cursor: pointer; }
	.led-button:hover { text-decoration: underline; }
	.led { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--off); flex: none; }
	.led.ok { background: var(--app); box-shadow: 0 0 6px var(--app); }
	.led.warn { background: var(--run); box-shadow: 0 0 6px var(--run); }
	.led.bad { background: var(--bad); box-shadow: 0 0 6px var(--bad); }
	@media (prefers-reduced-motion: no-preference) {
		.led.run { animation: blink 1.2s ease-in-out infinite; }
		@keyframes blink { 50% { opacity: 0.35; } }
	}
	.details { max-width: 40rem; margin: 0 auto; padding: 0.6rem var(--gutter) 0.75rem; border-top: 1px solid var(--rule); font-size: 0.85rem; }
	.details p { margin: 0.25rem 0; }
	.details ul { list-style: none; margin: 0.4rem 0; padding: 0; display: grid; gap: 0.35rem; }
	.details li { overflow-wrap: anywhere; }
	.details small, .when { color: var(--dim); }
	.pair { color: var(--run); }
	.dot { display: inline-block; width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--bad); margin-right: 0.35rem; }
	.dot.ok { background: var(--app); }
	.dot.blocked { background: transparent; border: 2px solid var(--dim); }
	.actions { display: flex; gap: 1rem; }
	.link { margin: 0.25rem 0 0; padding: 0; background: none; border: 0; color: var(--ink); text-decoration: underline; cursor: pointer; font-size: 0.85rem; }
	.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
