<script>
	// The v0.2 interface, beside the app at /app/ until the switch (docs/ui-v0.2).
	// Two views of one app: "Standard" and "Technisch" (lib/v2/view.js); the
	// technical view only adds. Areas: Start, Sicherung, Paket, Mehr, and System
	// in the technical view. Same origin, same vault module, same sealed
	// profile as v0.1: both read and write the same records.
	//
	// The shell: the way into the vault in plain words, the switch, the areas.
	// Start and Sicherung (lib/v2/Paperless.svelte) and Paket (lib/v2/Plan.svelte)
	// have their own design; the cards of System and Mehr are still the ones of
	// v0.1. Every area stays mounted while another one shows, so a running start
	// is never torn down.
	import { tick } from 'svelte';
	import { refreshBalancesSoon } from '$lib/balance-refresh.js';
	import System from '$lib/v2/System.svelte';
	import Addr from '$lib/Addr.svelte';
	import Paperless from '$lib/v2/Paperless.svelte';
	import Balances from '$lib/Balances.svelte';
	import VmList from '$lib/VmList.svelte';
	import Plan from '$lib/v2/Plan.svelte';
	import BackupLeds from '$lib/BackupLeds.svelte';
	import BuildInfo from '$lib/BuildInfo.svelte';
	import Help from '$lib/Help.svelte';
	import Logo from '$lib/Logo.svelte';
	import Confirm from '$lib/v2/Confirm.svelte';
	import { CREDITS_URL } from '$lib/credits.js';
	import { diagnosisText } from '$lib/diagnosis.js';
	import { knownCopies, rememberCopies } from '$lib/backup-status.js';
	import { endWarning } from '$lib/period-end.js';
	import { LANGS, format, lang, setLang, t } from '$lib/i18n/index.js';
	import { HOME } from '$lib/shared-origin.js';
	import { VIEWS, setView, technical, view } from '$lib/v2/view.js';
	import { createVaultSession } from '$lib/v2/vault-session.svelte.js';

	/* global __BUILD__ */
	const session = createVaultSession();
	const x = $derived($t.v2);
	const LANDING = $derived($lang === 'en' ? '/en/' : '/');
	$effect(() => {
		document.documentElement.lang = $lang;
	});
	// Back in this window (a top-up elsewhere): every balance anew (balance-refresh.js).
	$effect(() => {
		const back = () => {
			if (document.visibilityState === 'visible') refreshBalancesSoon();
		};
		document.addEventListener('visibilitychange', back);
		window.addEventListener('focus', back);
		return () => {
			document.removeEventListener('visibilitychange', back);
			window.removeEventListener('focus', back);
		};
	});

	// Before the vault is open.
	let name = $state('Paperless anywhere');
	let understood = $state(false);
	let haveVault = $state(false);
	let phrase = $state('');
	let withWords = $state(false);
	let trouble = $state(false);
	// A word is judged once its field is left, not while it is typed.
	/** @type {Record<number, boolean>} */
	let left = $state({});
	const openWithWords = async () => {
		await session.unlockPhrase(phrase);
		if (session.master) phrase = '';
	};

	// The areas. "System" exists in the technical view only; someone who
	// switches back while it shows lands on Start.
	/** @typedef {'start' | 'backup' | 'plan' | 'system' | 'more'} Area */
	/** @type {Area} */
	let area = $state('start');
	const AREAS = $derived(/** @type {Area[]} */ (['start', 'backup', 'plan', ...($technical ? ['system'] : []), 'more']));
	$effect(() => {
		if (!$technical && area === 'system') area = 'start';
	});
	/** @type {HTMLElement | undefined} */
	let main = $state();
	/** Shows an area and moves the focus to its heading. @param {Area} next */
	async function go(next) {
		area = next;
		await tick();
		/** @type {HTMLElement | null | undefined} */ (main?.querySelector(`#area-${next} h1`))?.focus();
	}

	// What the cards tell the shell.
	let profileVersion = $state(0);
	let acting = $state(false);
	/** @type {string[]} */
	let missing = $state([]);
	let vmsOpen = $state(false);
	// VMs this vault started that no card knows (VmList): they cost until adopted or deleted.
	let strays = $state(0);
	/** @type {import('$lib/Lifecycle.svelte').Glance | null} */
	let life = $state(null);
	/** @type {{ plan: boolean, hoursLeft: number | null, pays: string | null, low: boolean, endsAt: number | null } | null} */
	let pkg = $state(null);
	/** @type {{ money: string, lasts: string, warnings: ('start' | 'backups')[] } | null} */
	let summary = $state(null);
	let balancesShown = $state(false);
	let helpOpen = $state(false);
	let added = $state(false);

	// The lights of the backups: the newest backup's copies as the card read
	// them, or, while locked, the provider ids kept from that list.
	/** @type {{ network: string, copies: { providerId: number, url?: string }[], wanted?: number | null } | null} */
	let ledCopies = $state(null);
	let ledRemembered = $state('');
	/** @type {import('$lib/backup-status.js').Level} */
	let reachLed = $state('unknown');
	function fromMemory() {
		const k = knownCopies();
		ledCopies = k ? { network: k.network, copies: k.providerIds.map((providerId) => ({ providerId })), wanted: k.wanted } : null;
		ledRemembered = k?.at ?? '';
	}
	fromMemory();
	/** @param {{ network: string, copies: { providerId: number, url?: string }[], wanted: number | null }} c */
	function newestCopies(c) {
		rememberCopies(c.network, c.copies.map((y) => y.providerId), c.wanted);
		ledCopies = c;
		ledRemembered = '';
	}

	// The end of the paid time, shortly before it (period-end.js).
	let clock = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (clock = Date.now()), 60_000);
		return () => clearInterval(id);
	});
	const ending = $derived(CREDITS_URL && pkg?.endsAt != null ? endWarning(pkg.endsAt, clock) : null);
	const endsAtText = $derived(pkg?.endsAt != null ? format.dateTime(pkg.endsAt, undefined, $lang) : '');

	// Locking and leaving ask first while something is under way.
	/** @type {{ title: string, text: string, yes: string, no: string, danger?: boolean, then?: () => void, resolve?: (yes: boolean) => void } | null} */
	let asking = $state(null);
	const answer = (/** @type {boolean} */ yes) => {
		const a = asking;
		asking = null;
		if (yes) a?.then?.();
		a?.resolve?.(yes);
	};
	/** A question from a card, answered in the same dialog. @param {{ title: string, text: string, yes: string, no: string, danger?: boolean }} q @returns {Promise<boolean>} */
	const ask = (q) => new Promise((resolve) => (asking = { ...q, resolve }));
	function lockNow() {
		if (session.lock()) {
			fromMemory();
			area = 'start';
		}
	}
	const lock = () => {
		if (acting) asking = { title: x.leaveTitle, text: x.lockBusy, yes: x.lock, no: x.leaveNo, then: lockNow };
		else lockNow();
	};
	/** The way home locks the app: said, and asked while something runs. @param {MouseEvent} event */
	function leave(event) {
		if (session.state === 'phrase') return event.preventDefault();
		if (session.state !== 'unlocked' || !acting) return;
		event.preventDefault();
		asking = { title: x.leaveTitle, text: x.lockBusy, yes: x.leaveYes, no: x.leaveNo, then: () => (location.href = LANDING) };
	}
	const forget = () => {
		asking = { title: x.locked.forgetTitle, text: x.locked.forgetText, yes: x.locked.forgetYes, no: x.locked.forgetNo, danger: true, then: () => { session.forget(); ledCopies = null; trouble = false; } };
	};
	async function diagnose() {
		const cid = await fetch(location.href, { method: 'HEAD', cache: 'no-store' })
			.then((res) => res.headers.get('x-ipfs-roots')?.split(',')[0]?.trim() ?? '')
			.catch(() => '');
		return diagnosisText({ build: __BUILD__, cid, unlocked: Boolean(session.master), lang: $lang });
	}
	// The setup's sections open by themselves where something is missing (setup-card.svelte.js).
	const toSetup = () => {
		setView('technical');
		go('system');
	};
	const toVms = () => {
		setView('technical');
		vmsOpen = true;
		go('system');
	};
	/** The dialog for a card that asks with one sentence. @param {string} text */
	const askPlain = (text) => ask({ title: x.confirmTitle, text, yes: x.confirmYes, no: x.confirmNo });
	// The top of "System": what the shell knows of package and Paperless, each with where it leads.
	const systemState = $derived.by(() => {
		const g = $t.app.glance;
		return [
			...(CREDITS_URL && pkg ? [{ key: 'package', label: g.package, value: !pkg.plan ? g.noPackage : pkg.pays === 'app' || pkg.pays === 'wallet' ? g.notInUse : ending && ending !== 'ended' ? $t.pkg.ending.chip(endsAtText) : pkg.hoursLeft != null ? g.hoursLeft(pkg.hoursLeft) : g.active, tone: !pkg.plan || pkg.low || ending ? 'warn' : '', open: () => go('plan') }] : []),
			...(life ? [
				{ key: 'paperless', label: 'Paperless-ngx', value: /** @type {Record<string, string>} */ (g.phases)[life.phase] ?? life.phase, tone: life.phase === 'interrupted' ? 'warn' : '', open: () => go('start') },
				{ key: 'last-backup', label: $t.backup.overview.last, value: !life.backupsOn ? g.backupsOff : life.lastGood ? `${format.dateTime(life.lastGood.at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }, $lang)}${life.lastGood.copies ? ` · ${g.copies(life.lastGood.copies)}` : ''}` : g.noneYet, tone: !life.backupsOn || !life.lastGood ? 'warn' : '', open: () => go('backup') },
				// The address only while there is one; whether it is fixed is the setup's own row.
				...(life.host ? [{ key: 'host', label: g.address, value: life.host, tone: '', open: () => go('start') }] : [])
			] : [])
		];
	});
	const master = $derived(/** @type {Uint8Array} */ (session.master));
	const unlocked = $derived(session.state === 'unlocked');
</script>

<!-- A preview beside the app: not for search engines until the switch. -->
<svelte:head>
	<title>Paperless anywhere</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet viewSwitch()}
	<div class="seg" role="group" aria-label={x.view.label}>
		{#each VIEWS as v (v)}
			<button aria-pressed={$view === v} onclick={() => setView(v)} data-testid={`view-${v}`}>{x.view[v]}</button>
		{/each}
	</div>
{/snippet}
{#snippet langs()}
	<div class="langs" role="group" aria-label={$t.app.langLabel}>
		{#each LANGS as l (l)}
			<button class="lang" aria-pressed={$lang === l} lang={l} onclick={() => setLang(l)} data-testid={`v2-lang-${l}`}>{l.toUpperCase()}</button>
		{/each}
	</div>
{/snippet}
{#snippet facts(/** @type {Record<string, string[]>} */ rows, /** @type {string} */ title)}
	<div class="tech" data-testid="v2-tech">
		<p class="tk">{x.view.technical} · {title}</p>
		<dl>{#each Object.values(rows) as [k, v] (k)}<dt>{k}</dt><dd>{v}</dd>{/each}</dl>
	</div>
{/snippet}

<div class="v2" class:with-nav={unlocked}>
	<header class="top">
		<div class="bar">
			<Logo href={LANDING} label={unlocked ? $t.app.homeLocks : $t.app.home} onnavigate={leave} size={30} />
			<div class="tools">
				{@render viewSwitch()}
				{#if unlocked}<button class="ghost" onclick={lock} data-testid="v2-lock">{x.lock}</button>{:else if session.state !== 'phrase'}{@render langs()}{/if}
			</div>
		</div>
	</header>

	<main bind:this={main}>
		<p class="sr-only" data-testid="v2-state">{session.state}</p>
		<p class="preview" data-testid="v2-preview">{x.preview} <a href="/app/">{x.toOld}</a></p>

		{#if session.state === 'framed'}
			<section class="card"><p>{$t.app.framed.before}<a href={HOME} target="_blank" rel="noopener">{HOME}</a>{$t.app.framed.after}</p></section>
		{:else if session.state === 'shared'}
			<section class="card"><p>{$t.app.shared.before}<a href={HOME}>{HOME}</a>{$t.app.shared.after}</p></section>
		{:else if session.state === 'new' && !haveVault}
			<p class="stepno">{x.step(1, 3)}</p>
			<section class="card">
				<h1>{x.welcome.title}</h1>
				<p>{x.welcome.lede}</p>
				<ul class="points">{#each x.welcome.points as point (point)}<li>{point}</li>{/each}</ul>
			</section>
			<section class="risk" data-testid="v2-key-loss">
				<p><strong>{x.welcome.riskStrong}</strong> {x.welcome.risk}</p>
				<label class="check"><input type="checkbox" bind:checked={understood} data-testid="v2-key-loss-ok" /> <span>{x.welcome.understood}</span></label>
			</section>
			<button class="cta" onclick={() => session.create(name)} disabled={session.busy || !understood} data-testid="v2-create">{x.welcome.create}</button>
			<p class="hint">{x.welcome.createHint}</p>
			<button class="sec" onclick={() => (haveVault = true)} data-testid="v2-have-vault">{x.welcome.have}</button>
			{#if $technical}
				{@render facts(x.welcome.tech, x.welcome.techTitle)}
				<label class="field">{x.welcome.nameLabel} <input bind:value={name} /></label>
			{/if}
		{:else if session.state === 'new'}
			<section class="card">
				<h1>{x.open.title}</h1>
				<p>{x.open.lede}</p>
				<button class="cta" onclick={session.unlockPasskey} disabled={session.busy || session.passkeyWaiting} data-testid="v2-open-passkey">{x.open.passkey}</button>
				{#if session.passkeyWaiting}<p class="hint" role="status">{x.open.waiting(location.host)}</p>{/if}
				<label class="field" for="v2-words">{x.open.wordsLabel}</label>
				<textarea id="v2-words" bind:value={phrase} rows="4" autocomplete="off" autocapitalize="none" spellcheck="false" data-testid="v2-words"></textarea>
				<button class="sec" onclick={openWithWords} disabled={session.busy || !phrase.trim()} data-testid="v2-open-words">{x.open.words}</button>
				<button class="lnk" onclick={() => (haveVault = false)}>{x.welcome.back}</button>
			</section>
		{:else if session.state === 'locked'}
			<section class="card">
				<h1>{x.locked.title}</h1>
				<p>{x.locked.lede}</p>
				<button class="cta" onclick={session.unlockPasskey} disabled={session.busy || session.passkeyWaiting} data-testid="v2-unlock">{x.locked.passkey}</button>
				{#if session.passkeyWaiting}<p class="hint" role="status">{x.locked.waiting}</p>{/if}
				{#if !withWords}
					<button class="sec" onclick={() => (withWords = true)} data-testid="v2-with-words">{x.locked.withWords}</button>
				{:else}
					<label class="field" for="v2-words">{x.locked.wordsLabel}</label>
					<textarea id="v2-words" bind:value={phrase} rows="4" autocomplete="off" autocapitalize="none" spellcheck="false" data-testid="v2-words"></textarea>
					<button class="sec" onclick={openWithWords} disabled={session.busy || !phrase.trim()} data-testid="v2-unlock-words">{x.locked.words}</button>
				{/if}
				<button class="lnk" aria-expanded={trouble} onclick={() => (trouble = !trouble)} data-testid="v2-trouble">{x.locked.trouble}</button>
				{#if trouble}
					<p class="hint">{x.locked.troubleText}</p>
					<button class="lnk" onclick={forget} data-testid="v2-forget">{x.locked.forget}</button>
				{/if}
			</section>
			<section class="card"><BackupLeds copies={ledCopies} remembered={ledRemembered} onreach={(l) => (reachLed = l)} /></section>
		{:else if session.state === 'phrase'}
			<p class="stepno">{x.step(session.confirming ? 3 : 2, 3)}</p>
			<section class="card">
				{#if !session.confirming}
					<h1>{x.phrase.title}</h1>
					<p>{x.phrase.lede}</p>
					<ol class="words" data-testid="v2-phrase">{#each session.words as word, i (i)}<li>{word}</li>{/each}</ol>
					<button class="cta" onclick={session.startConfirm} data-testid="v2-written">{x.phrase.written}</button>
					<p class="hint">{x.phrase.next}</p>
				{:else}
					<h1>{x.phrase.checkTitle}</h1>
					{#each session.askPositions as position, i (position)}
						<label class="field" for={`v2-confirm-${position + 1}`}>{x.phrase.word(position + 1)}</label>
						<input id={`v2-confirm-${position + 1}`} bind:value={session.answers[i]} autocomplete="off" autocapitalize="none" spellcheck="false" onblur={() => (left[position] = true)} aria-invalid={left[position] && session.checks[i] === false} aria-describedby={left[position] && session.checks[i] === false ? `v2-wrong-${position + 1}` : undefined} data-testid={`v2-confirm-${position + 1}`} />
						{#if left[position] && session.checks[i] === false}<p class="wrong" id={`v2-wrong-${position + 1}`} role="status" data-testid={`v2-wrong-${position + 1}`}>{x.phrase.wrong}</p>
						{:else if session.checks[i]}<p class="right" role="status">{x.phrase.right}</p>{/if}
					{/each}
					<button class="cta" onclick={session.doneConfirm} disabled={!session.answered} data-testid="v2-confirmed">{x.phrase.done}</button>
					<button class="lnk" onclick={() => (session.confirming = false)}>{x.phrase.again}</button>
				{/if}
			</section>
			<p class="ok" data-testid="v2-phrase-guard">{x.phrase.guard}</p>
			{#if $technical}{@render facts(x.phrase.tech, x.phrase.techTitle)}{/if}
		{/if}

		<!-- The areas stay mounted from the moment the vault opens (also while the
		     24 words show: the balances feed the warnings), and only one shows. -->
		{#if session.master}
			<div hidden={!unlocked}>
				{#if ending}
					<section class="alert" class:urgent={ending !== 'soon'} role="alert" data-testid="v2-period-ending">
						<p><strong>{$t.pkg.ending[ending](endsAtText)}</strong> {$t.pkg.ending.what}</p>
						<button class="sec" onclick={() => go('plan')}>{$t.pkg.ending.more}</button>
					</section>
				{/if}
				{#if strays && area === 'start'}
					<section class="alert" role="status" data-testid="v2-stray">
						<p><strong>{x.system.strayStrong(strays)}</strong> {x.system.stray}</p>
						<button class="sec" onclick={toVms} data-testid="v2-stray-open">{$technical ? x.system.strayButtonTechnical : x.system.strayButton}</button>
					</section>
				{/if}
				{#if summary && area === 'start'}
					{#each summary.warnings as w (w)}
						<section class="alert" role="status" data-testid={`v2-warning-${w}`}>
							<p>{w === 'start' ? (CREDITS_URL ? $t.app.simple.startShortCredits : $t.app.simple.startShort) : $t.app.simple.backupsShort}</p>
							<button class="sec" onclick={() => go('plan')}>{x.areas.plan}</button>
						</section>
					{/each}
				{/if}

				{#snippet lights()}<BackupLeds copies={ledCopies} remembered={ledRemembered} onreach={(l) => (reachLed = l)} />{/snippet}
				<Paperless {master} technical={$technical} {area} version={profileVersion} reach={reachLed} confirm={ask} {lights} onchange={() => profileVersion++} onsetup={toSetup} onpackage={() => go('plan')} onmissing={(m) => (missing = m)} onglance={(g) => (life = g)} onbusy={(b) => (acting = b)} oncopies={newestCopies} />

				<section id="area-plan" hidden={area !== 'plan'} aria-labelledby="h-plan">
					<h1 id="h-plan" tabindex="-1">{x.areas.plan}</h1>
					{#if CREDITS_URL}<Plan {master} technical={$technical} version={profileVersion} {acting} confirm={ask} onsetup={toSetup} onglance={(g) => (pkg = g)} onprofile={() => profileVersion++} />{/if}
					<!-- Only where the person pays with crypto themselves; mounted in both views, since it feeds the warnings. -->
					<details class="part" hidden={!$technical || !balancesShown} data-testid="v2-balances">
						<summary>{$t.app.tech.wallet}{#if summary?.money} <span class="chip">{summary.money}</span>{/if}</summary>
						<Balances {master} version={profileVersion} onsummary={(s) => (summary = s)} onshown={(v) => (balancesShown = v)} />
					</details>
				</section>

				<!-- Mounted in both views (the VM list reports strays, the setup what is missing); shown in the technical one. -->
				<section id="area-system" hidden={area !== 'system' || !$technical} aria-labelledby="h-system">
					<h1 id="h-system" tabindex="-1">{x.system.title}</h1>
					<p class="hint">{x.system.lede}</p>
					<System {master} version={profileVersion} state={systemState} confirm={ask} onplan={() => go('plan')} onsaved={() => profileVersion++} />
					<details class="part" bind:open={vmsOpen} data-testid="v2-vms">
						<summary>{$t.app.tech.vms}{#if strays} <span class="chip warn">{strays}</span>{/if}</summary>
						<VmList {master} version={profileVersion} onchange={() => profileVersion++} confirm={askPlain} onstrays={(n) => (strays = n)} />
					</details>
				</section>

				<section id="area-more" hidden={area !== 'more'} aria-labelledby="h-more">
					<h1 id="h-more" tabindex="-1">{x.areas.more}</h1>
					<div class="card">
						<h2>{x.more.keys}</h2>
						<p>{x.more.keysText}</p>
						<!-- The app's address in one place, with a copy button (v0.1 showed it in four, under three names). -->
						{#if $technical}<p class="tline">{x.more.appKey}: <Addr value={session.address} testid="v2-address" /></p>{/if}
						<h3>{x.more.addDevice}</h3>
						<p class="hint">{x.more.addDeviceText(location.host)}</p>
						<button class="sec" onclick={async () => { added = false; await session.newPasskey(name); added = !session.error; }} disabled={session.busy} data-testid="v2-add-passkey">{x.more.addPasskey}</button>
						{#if added}<p class="ok" role="status" data-testid="v2-passkey-added">{x.more.added}</p>{/if}
						<h3>{x.locked.forget}</h3>
						<p class="hint">{x.more.forgetText}</p>
						<button class="lnk" onclick={forget} data-testid="v2-forget-here">{x.locked.forget}</button>
					</div>
					<div class="card">
						<h2>{x.more.settings}</h2>
						<div class="setrow"><span>{x.view.label}</span>{@render viewSwitch()}</div>
						<div class="setrow"><span>{x.more.language}</span>{@render langs()}</div>
					</div>
				</section>
			</div>
		{/if}

		{#if session.error}<p class="error" role="alert" data-testid="v2-error">{session.error}</p>{/if}

		<!-- Help and the legal links: with the vault open under "Mehr", before that always. -->
		<div hidden={unlocked && area !== 'more'}>
			<Help t={$t.help} lang={$lang} faq={$lang === 'en' ? '/en/#faq' : '/#faq'} diagnosis={diagnose} bind:open={helpOpen} />
			<BuildInfo simple={!$technical} />
		</div>
	</main>

	{#if unlocked}
		<nav class="areas" aria-label={x.areas.label}>
			{#each AREAS as a (a)}
				<button aria-current={area === a ? 'page' : undefined} onclick={() => go(a)} data-testid={`v2-area-${a}`}>
					<span class="lbl">{x.areas[a]}</span>
					{#if a === 'backup' && (reachLed === 'warn' || reachLed === 'bad')}<span class="dot" class:bad={reachLed === 'bad'} aria-label={$t.app.leds.levels[reachLed]}></span>{/if}
				</button>
			{/each}
		</nav>
	{/if}
</div>

{#if asking}<Confirm open title={asking.title} text={asking.text} yes={asking.yes} no={asking.no} danger={asking.danger} onanswer={answer} />{/if}

<style>
	/* Standard is sized for everyday use: body 17/27, main buttons 52px, every target at least 44px. */
	.v2 { font-size: 1.0625rem; line-height: 1.6; }
	.v2.with-nav { padding-bottom: 5rem; }
	.top { border-bottom: 1px solid var(--line); background: var(--surface); }
	.bar { max-width: 40rem; margin: 0 auto; padding: 0.6rem var(--gutter); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
	.tools { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; justify-content: flex-end; }
	main { max-width: 40rem; margin: 0 auto; padding: 1rem var(--gutter) 2rem; }
	h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 0.5rem; }
	h1:focus { outline: none; }
	h2 { margin: 0 0 0.4rem; }
	h3 { margin: 1rem 0 0.25rem; }
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.1rem; margin: 0 0 0.9rem; box-shadow: var(--shadow); }
	.card p { margin: 0 0 0.75rem; }
	.preview { font-size: 0.9rem; color: var(--text-2); margin: 0 0 0.9rem; }
	.stepno { font-family: var(--mono); font-size: 0.8rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-2); margin: 0 0 0.5rem; }
	.points { margin: 0; padding-left: 1.2rem; }
	.points li { margin: 0.25rem 0; }
	.risk, .alert { background: var(--warn-bg); color: var(--warn); border: 1px solid currentColor; border-radius: var(--radius-sm); padding: 0.8rem 0.9rem; margin: 0 0 0.9rem; }
	.alert.urgent { border-width: 2px; }
	.risk p, .alert p { margin: 0 0 0.6rem; }
	.check { display: flex; gap: 0.6rem; align-items: flex-start; }
	.check input { width: 1.4rem; height: 1.4rem; flex: none; margin-top: 0.2rem; }
	button { font: inherit; }
	.cta, .sec { display: block; width: 100%; min-height: 3.25rem; padding: 0.6rem 1.1rem; margin: 0.6rem 0 0; font-size: 1.05rem; font-weight: 600; }
	.sec { background: transparent; color: var(--text); border-color: var(--text-2); }
	.alert .sec { color: inherit; border-color: currentColor; min-height: 2.75rem; }
	.lnk { background: none; border: 0; border-radius: 0; color: var(--accent-2-text); text-decoration: underline; text-underline-offset: 3px; padding: 0.6rem 0; min-height: 2.75rem; text-align: left; display: block; }
	.ghost { background: transparent; color: var(--text); border-color: var(--line); padding: 0.4rem 0.9rem; min-height: 2.75rem; }
	.hint { color: var(--text-2); font-size: 0.95rem; margin: 0.5rem 0 0; }
	.field { display: block; margin: 0.9rem 0 0.3rem; font-size: 0.95rem; color: var(--text-2); }
	textarea, input:not([type='checkbox']) { width: 100%; min-height: 2.75rem; font-size: 1.05rem; }
	.words { columns: 2; font-family: var(--mono); font-size: 0.95rem; padding-left: 2rem; margin: 0.5rem 0 0.75rem; }
	.wrong { color: var(--danger); background: var(--danger-bg); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); margin: 0.3rem 0 0; font-size: 0.95rem; }
	.right { color: var(--ok); margin: 0.3rem 0 0; font-size: 0.95rem; }
	.ok { color: var(--ok); background: var(--ok-bg); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); margin: 0 0 0.9rem; font-size: 0.95rem; }
	.error { color: var(--danger); background: var(--danger-bg); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); }
	/* The switch: two segments, the pressed one raised. */
	.seg { display: inline-flex; padding: 3px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; }
	.seg button { background: transparent; color: var(--text-2); border: 0; padding: 0.35rem 0.8rem; min-height: 2.75rem; font-size: 0.9rem; }
	.seg button[aria-pressed='true'] { background: var(--surface); color: var(--text); font-weight: 600; box-shadow: 0 0 0 1px var(--line); }
	.langs { display: inline-flex; gap: 0.25rem; }
	.lang { font-family: var(--mono); font-size: 0.8rem; min-height: 2.75rem; min-width: 2.75rem; padding: 0.25rem 0.7rem; background: transparent; color: var(--text-2); border: 1px solid var(--line); }
	.lang[aria-pressed='true'] { background: var(--cta-bg); color: var(--cta-text); border-color: var(--cta-bg); }
	/* What only the technical view adds. */
	.tech { background: var(--surface-2); border: 1px dashed var(--text-2); border-radius: var(--radius-sm); padding: 0.75rem; margin: 0.9rem 0; font-size: 0.9rem; }
	.tk { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-2); margin: 0 0 0.4rem; }
	.tech dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.75rem; }
	.tech dt { color: var(--text-2); }
	.tech dd { margin: 0; font-family: var(--mono); font-size: 0.85rem; overflow-wrap: anywhere; }
	.tline { font-family: var(--mono); font-size: 0.85rem; color: var(--text-2); overflow-wrap: anywhere; }
	.part { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 0.9rem 1.1rem; margin: 0 0 0.9rem; }
	.part > summary { font-weight: 600; min-height: 2.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
	.part > :global(:is(.balances, .vms, .setup)) { margin: 0; padding: 0.25rem 0 0; border: 0; box-shadow: none; background: transparent; }
	.chip { font-size: 0.8rem; font-weight: 500; padding: 0.1rem 0.6rem; border-radius: 999px; background: var(--surface-2); color: var(--text-2); white-space: nowrap; }
	.chip.warn { background: var(--warn-bg); color: var(--warn); }
	.setrow { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; padding: 0.5rem 0; border-top: 1px solid var(--line); }
	.setrow:first-of-type { border-top: 0; }
	/* The areas: a bar at the bottom, in reach of a thumb. */
	.areas { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; background: var(--surface); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom, 0px); z-index: 5; }
	.areas button { flex: 1 1 0; max-width: 9rem; min-height: 3.5rem; background: transparent; color: var(--text-2); border: 0; border-radius: 0; border-top: 3px solid transparent; font-size: 0.95rem; position: relative; }
	.areas button[aria-current='page'] { color: var(--text); font-weight: 600; border-top-color: var(--accent); }
	.dot { position: absolute; top: 0.5rem; right: calc(50% - 2.2rem); width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--accent); }
	.dot.bad { background: var(--danger); }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
