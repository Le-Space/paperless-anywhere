<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import { addPasskey, confirmationPositions, createVault, forgetVault, loadVault, unlockWithPasskey, unlockWithSeedPhrase } from '$lib/keys/vault.js';
	import Setup from '$lib/Setup.svelte';
	import Lifecycle from '$lib/Lifecycle.svelte';
	import Balances from '$lib/Balances.svelte';
	import VmList from '$lib/VmList.svelte';
	import Package from '$lib/Package.svelte';
	import { CREDITS_URL } from '$lib/credits.js';
	import BuildInfo from '$lib/BuildInfo.svelte';
	import Logo from '$lib/Logo.svelte';
	import NgxText from '$lib/NgxText.svelte';
	import { texts } from '$lib/landing/i18n.js';
	import { LANGS, format, lang, setLang, t, tr } from '$lib/i18n/index.js';
	import { HOME, sharedOrigin } from '$lib/shared-origin.js';

	// On a path-style gateway the origin is shared: no vault, no passkey there.
	const shared = sharedOrigin();
	let vault = $state(shared ? null : loadVault());
	/** @type {Uint8Array | null} the master secret, in memory only */
	let master = $state(null);
	let phrase = $state('');
	let shownPhrase = $state('');
	let name = $state('Paperless anywhere');
	// The key-loss notice must be ticked before a vault is created.
	let understood = $state(false);
	let error = $state('');
	let busy = $state(false);
	let profileVersion = $state(0);
	// After the phrase is shown, three of its words are asked back.
	/** @type {number[]} */
	let askPositions = $state([]);
	/** @type {string[]} */
	let answers = $state([]);
	let confirming = $state(false);
	let added = $state('');
	const answered = $derived(
		askPositions.length > 0 && askPositions.every((p, i) => (answers[i] ?? '').trim().toLowerCase() === shownPhrase.split(' ')[p])
	);
	function startConfirm() {
		askPositions = confirmationPositions();
		answers = askPositions.map(() => '');
		confirming = true;
	}
	function doneConfirm() {
		shownPhrase = '';
		confirming = false;
		askPositions = [];
		answers = [];
	}
	const newPasskey = () => run(async () => {
		await addPasskey(/** @type {Uint8Array} */ (master), `${name.trim() || 'Paperless anywhere'} (${location.host})`);
		vault = loadVault();
		added = location.host;
	});

	const address = $derived(master ? privateKeyToAccount(alephPrivateKey(master)).address : '');
	const state = $derived(!vault ? 'new' : master ? 'unlocked' : 'locked');

	async function run(fn) {
		error = '';
		busy = true;
		try {
			await fn();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	const create = () => run(async () => {
		const result = await createVault(name.trim() || 'Paperless anywhere');
		vault = loadVault();
		master = result.master;
		shownPhrase = result.phrase;
	});
	// A passkey prompt may never answer (no passkey for this address, a dialog
	// left open): it blocks only the passkey buttons, never the 24 words.
	let passkeyWaiting = $state(false);
	async function unlockPasskey() {
		error = '';
		passkeyWaiting = true;
		try {
			const opened = await unlockWithPasskey(vault);
			if (!master) {
				master = opened;
				vault = loadVault();
			} else opened.fill(0);
		} catch (e) {
			if (!master) error = e instanceof Error ? e.message : String(e);
		} finally {
			passkeyWaiting = false;
		}
	}
	const unlockPhrase = () => run(async () => {
		master = await unlockWithSeedPhrase(vault, phrase);
		vault = loadVault();
		phrase = '';
	});
	// The landing page, on the same origin, at the address of the language
	// chosen there (German at /, English at /en/).
	const LANDING = $derived($lang === 'en' ? '/en/' : '/');
	// The shell's <html lang> follows the language chosen here.
	$effect(() => {
		document.documentElement.lang = $lang;
	});
	// A start, a backup or a stop under way in the lifecycle card.
	let acting = $state(false);
	/**
	 * The way home. The unlock lives in this page's memory only, so leaving
	 * locks the app; that is fine and the link says so. While something is
	 * under way it asks first: the VM carries on, but this page stops
	 * following it.
	 * @param {MouseEvent} event
	 */
	function leave(event) {
		if (state === 'unlocked' && acting && !confirm(tr().app.leaveBusy)) event.preventDefault();
	}
	function lock() {
		master?.fill(0);
		master = null;
		shownPhrase = '';
	}
	function reset() {
		if (!confirm(tr().app.forgetConfirm)) return;
		lock();
		forgetVault();
		vault = null;
	}

	// Two views of the same app: the everyday one (start, open, stop) and
	// "Erweitert" with every setting. The choice is remembered in this browser
	// only once someone picks a tab, and holds nothing secret.
	const TAB_KEY = 'paperless-anywhere.tab';
	/** @type {'simple' | 'advanced'} */
	let tab = $state('simple');
	try {
		if (localStorage.getItem(TAB_KEY) === 'advanced') tab = 'advanced';
	} catch {
		// Storage blocked: the simple view.
	}
	const showTab = (/** @type {'simple' | 'advanced'} */ t) => {
		tab = t;
		try {
			localStorage.setItem(TAB_KEY, t);
		} catch {
			// Storage blocked: only for this visit.
		}
	};
	const simple = $derived(tab === 'simple');
	// The setup opens by itself only when something required is missing, or
	// from "Einrichtung öffnen" in the overview.
	let setupOpen = $state(false);
	/** @type {string[]} */
	let missing = $state([]);
	// "Auf einen Blick" (#105): one row per card, each with its state.
	/** @type {import('$lib/Lifecycle.svelte').Glance | null} */
	let life = $state(null);
	/** @type {{ plan: boolean, hoursLeft: number | null, pays: string | null, low: boolean } | null} */
	let pkg = $state(null);
	const when = (/** @type {string} */ at) => format.dateTime(at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }, $lang);
	// `key` names a row whatever the language (tests and anchors use it).
	const glance = $derived.by(() => {
		const g = $t.app.glance;
		return [
			...(CREDITS_URL && pkg ? [{ key: 'package', id: 'paket', label: g.package, state: !pkg.plan ? g.noPackage : pkg.pays === 'app' || pkg.pays === 'wallet' ? g.notInUse : pkg.hoursLeft != null ? g.hoursLeft(pkg.hoursLeft) : g.active, tone: !pkg.plan || pkg.low ? 'warn' : pkg.pays === 'app' || pkg.pays === 'wallet' ? '' : 'ok' }] : []),
			...(life ? [
				{ key: 'paperless', id: 'paperless', label: 'Paperless-ngx', state: /** @type {Record<string, string>} */ (g.phases)[life.phase] ?? life.phase, tone: life.phase === 'running' ? 'ok' : life.phase === 'interrupted' ? 'warn' : '' },
				{ key: 'backups', id: 'paperless', label: g.backups, state: !life.backupsOn ? g.backupsOff : life.lastGood ? `${when(life.lastGood.at)}${life.lastGood.copies ? ` · ${g.copies(life.lastGood.copies)}` : ''}` : g.noneYet, tone: !life.backupsOn || !life.lastGood ? 'warn' : 'ok' },
				{ key: 'address', id: 'technisch', label: g.address, state: life.host ?? (life.fixedHost ? g.fixedAddress : g.newAddress), tone: '' },
				{ key: 'pays', id: 'technisch', label: g.payWay, state: life.pays ? /** @type {Record<string, string>} */ (g.pays)[life.pays] : g.notChosen, tone: life.pays ? '' : 'warn' }
			] : [])
		];
	});
	const openSetup = () => {
		setupOpen = true;
		showTab('advanced');
	};
	/** @type {{ money: string, lasts: string, warnings: ('start' | 'backups')[] } | null} */
	let summary = $state(null);
	let balancesShown = $state(false);
</script>

<!-- Its own title: coming from the landing page, the tab would keep that one. -->
<svelte:head>
	<title>Paperless anywhere</title>
</svelte:head>

<header class="top">
	<div class="bar">
		<Logo href={LANDING} label={state === 'unlocked' ? $t.app.homeLocks : $t.app.home} onnavigate={leave}>{#snippet sub()}<NgxText text={texts[$lang].tagline} link />{/snippet}</Logo>
		<div class="tools">
			<!-- Changes the language at once; nothing reloads, so the vault stays open. -->
			<div class="langs" role="group" aria-label={$t.app.langLabel}>
				{#each LANGS as l}
					<button class="lang" class:on={$lang === l} aria-pressed={$lang === l} lang={l} onclick={() => setLang(l)} data-testid={`app-lang-${l}`}>{l.toUpperCase()}</button>
				{/each}
			</div>
			{#if state === 'unlocked'}<button class="ghost" onclick={lock} data-testid="lock">{$t.app.lock}</button>{/if}
		</div>
	</div>
</header>

<main>
	<p class="sr-only" data-testid="state">{shared ? 'shared origin' : state}</p>

	{#if shared}
		<section class="card">
			<p data-testid="shared-origin">{$t.app.shared.before}<a href={HOME}>{HOME}</a>{$t.app.shared.after}</p>
		</section>
	{:else if state === 'new'}
		<!-- Coming from the landing page most people have no vault yet: creating
		     one comes first, opening an existing one second. -->
		<section class="card hero">
			<h1>{$t.app.create.title}</h1>
			<p class="lede">{$t.app.create.lede}</p>
			<div class="risk" data-testid="key-loss">
				<p><strong>{$t.app.create.riskStrong}</strong> {$t.app.create.risk}</p>
				<label class="check"><input type="checkbox" bind:checked={understood} data-testid="key-loss-ok" /> {$t.app.create.understood}</label>
			</div>
			<button class="primary" onclick={create} disabled={busy || !understood} data-testid="create-vault">{$t.app.create.button}</button>
			<details class="fold">
				<summary>{$t.app.create.renameFold}</summary>
				<label>{$t.app.create.renameLabel} <input bind:value={name} /></label>
			</details>
		</section>
		<section class="card">
			<h2>{$t.app.open.title}</h2>
			<button class="secondary" onclick={unlockPasskey} disabled={busy || passkeyWaiting}>{$t.app.open.passkey}</button>
			{#if passkeyWaiting}<p class="hint" data-testid="passkey-waiting">{$t.app.open.waitingNone(location.host)}</p>{/if}
			<details class="fold">
				<summary data-testid="open-with-phrase">{$t.app.open.phraseFold}</summary>
				<textarea bind:value={phrase} rows="3" autocomplete="off" spellcheck="false"></textarea>
				<button class="secondary" onclick={unlockPhrase} disabled={busy || !phrase.trim()} data-testid="open-phrase">{$t.app.open.button}</button>
			</details>
		</section>
	{:else if state === 'locked'}
		<section class="card hero">
			<h1>{$t.app.locked.title}</h1>
			<p class="lede">{$t.app.locked.lede}</p>
			<button class="primary" onclick={unlockPasskey} disabled={busy || passkeyWaiting}>{$t.app.locked.passkey}</button>
			{#if passkeyWaiting}<p class="hint" data-testid="passkey-waiting">{$t.app.locked.waiting}</p>{/if}
			<details class="fold">
				<summary>{$t.app.locked.phraseFold}</summary>
				<textarea bind:value={phrase} rows="3" autocomplete="off" spellcheck="false"></textarea>
				<button class="secondary" onclick={unlockPhrase} disabled={busy || !phrase.trim()}>{$t.app.locked.button}</button>
			</details>
			<button class="quiet" onclick={reset}>{$t.app.locked.forget}</button>
		</section>
	{:else}
		{#if shownPhrase}
			<section class="card phrase">
				<h2>{$t.app.phrase.title}</h2>
				<p>{$t.app.phrase.lede}</p>
				{#if !confirming}
					<ol data-testid="phrase">{#each shownPhrase.split(' ') as word}<li>{word}</li>{/each}</ol>
					<button class="primary" onclick={startConfirm}>{$t.app.phrase.written}</button>
				{:else}
					<p>{$t.app.phrase.check}</p>
					{#each askPositions as position, i (position)}
						<label>{$t.app.phrase.word(position + 1)} <input bind:value={answers[i]} autocomplete="off" spellcheck="false" data-testid={`confirm-${position + 1}`} /></label>
					{/each}
					<button class="primary" onclick={doneConfirm} disabled={!answered}>{$t.app.phrase.right}</button>
					<button class="quiet" onclick={() => (confirming = false)}>{$t.app.phrase.again}</button>
				{/if}
			</section>
		{:else}
			<div class="tabs" role="tablist" aria-label={$t.app.tabs.label}>
				<button role="tab" aria-selected={simple} class:on={simple} onclick={() => showTab('simple')} data-testid="tab-simple">{$t.app.tabs.simple}</button>
				<button role="tab" aria-selected={!simple} class:on={!simple} onclick={() => showTab('advanced')} data-testid="tab-advanced">{$t.app.tabs.advanced}</button>
			</div>
		{/if}
		{#if !shownPhrase}
			<!-- Erweitert puts what we sell first: the package, then Paperless itself,
			     then keys, balances, VMs and the setup (#105). The overview keeps
			     Paperless first; only the package moves, by CSS order, so a running
			     checkout is not torn down when the tab changes. -->
			<div class="stack" class:simple>
				{#if !simple && glance.length}
					<section class="card glance" data-testid="glance">
						<h2>{$t.app.glance.title}</h2>
						<ul>
							{#each glance as row (row.key)}
								<li><a href={`#${row.id}`}>{row.label}</a><span class="chip {row.tone}" data-testid={`glance-${row.key}`}>{row.state}</span></li>
							{/each}
						</ul>
					</section>
				{/if}
				<div class="life" id="paperless"><Lifecycle {master} {simple} version={profileVersion} onchange={() => profileVersion++} onadvanced={openSetup} onmissing={(m) => { missing = m; if (m.length) setupOpen = true; }} onglance={(g) => (life = g)} onbusy={(b) => (acting = b)} /></div>
				{#if CREDITS_URL}<div class="pkg" id="paket"><Package {master} version={profileVersion} onglance={(g) => (pkg = g)} /></div>{/if}
			</div>
		{/if}
		<!-- "Technisch" (#105): what the everyday use does not need, folded, one
		     click away. Rendered also while the words are shown (hidden then): the
		     address is known from the first moment, and the balances feed the
		     overview's warnings. -->
		<section class="card tech" id="technisch" hidden={simple || !!shownPhrase} data-testid="tech">
			<h2>{$t.app.tech.title}</h2>
			<p class="purpose">{$t.app.tech.purpose}</p>
			<details class="part" data-testid="tech-keys">
				<summary><span>{$t.app.tech.keys}</span></summary>
				<p>{$t.app.tech.unlocked} <code data-testid="address">{address}</code>
					<br /><small class="hint">{$t.app.tech.keyHint}</small></p>
				<details class="fold">
					<summary>{$t.app.tech.addFold}</summary>
					<p class="hint">{$t.app.tech.addHint(location.host)}</p>
					<button class="secondary" onclick={newPasskey} disabled={busy} data-testid="add-passkey">{$t.app.tech.addButton(location.host)}</button>
					{#if added}<p data-testid="passkey-added">{$t.app.tech.added(added)}</p>{/if}
				</details>
			</details>
			{#if !shownPhrase}
				<!-- Only where the person pays with crypto themselves; Balances still reads the start warning otherwise. -->
				<details class="part" data-testid="tech-balances" hidden={!balancesShown}>
					<summary><span>{$t.app.tech.wallet}</span>{#if summary?.money}<span class="chip">{summary.money}</span>{/if}</summary>
					<Balances {master} version={profileVersion} onsummary={(s) => (summary = s)} onshown={(v) => (balancesShown = v)} />
				</details>
				<details class="part" data-testid="tech-vms">
					<summary><span>{$t.app.tech.vms}</span></summary>
					<VmList {master} version={profileVersion} onchange={() => profileVersion++} />
				</details>
				<details class="part" bind:open={setupOpen} data-testid="tech-setup">
					<summary><span>{$t.app.tech.setup}</span><span class="chip" class:warn={missing.length > 0}>{missing.length ? $t.app.tech.missing : $t.app.tech.complete}</span></summary>
					<Setup {master} onsaved={() => profileVersion++} />
				</details>
			{/if}
		</section>
		{#if !shownPhrase}
			<!-- With Le Space Credits a customer sees the package and euros only; Aleph
			     and Filecoin balances stay under "Erweitert". -->
			{#if simple && summary}
				{#if !CREDITS_URL && summary.money}
					<section class="card money" data-testid="simple-balance">
						<p class="line"><span class="label">{$t.app.simple.balance}</span> <span class="data">{summary.money}</span>{#if summary.lasts}<span class="hint">{$t.app.simple.lasts(summary.lasts)}</span>{/if}</p>
					</section>
				{/if}
				{#each summary.warnings as w (w)}
					<p class="warn" role="status" data-testid={`simple-warning-${w}`}>{w === 'start'
						? (CREDITS_URL ? $t.app.simple.startShortCredits : $t.app.simple.startShort)
						: $t.app.simple.backupsShort}</p>
				{/each}
			{/if}
		{/if}
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<BuildInfo />
</main>

<style>
	.top { border-bottom: 1px solid var(--line); background: var(--surface); }
	.bar { max-width: 40rem; margin: 0 auto; padding: 0.75rem var(--gutter); display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
	main { max-width: 40rem; margin: 0 auto; padding: 1.5rem var(--gutter) 2rem; }
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem; margin: 0 0 1rem; box-shadow: var(--shadow); }
	.hero h1 { font-size: 1.75rem; margin: 0 0 0.5rem; }
	.lede { color: var(--text-2); margin: 0 0 1.25rem; }
	.card h2 { margin: 0 0 0.5rem; }
	.risk { border-left: 4px solid var(--warn); background: var(--warn-bg); padding: 0.6rem 0.9rem; margin: 1rem 0; border-radius: var(--radius-sm); }
	.risk p { margin: 0 0 0.5rem; }
	.check { display: flex; gap: 0.5rem; align-items: flex-start; }
	.check input { width: auto; margin-top: 0.2rem; }
	button { display: block; margin: 0.75rem 0; padding: 0.6rem 1.1rem; font-size: 1rem; }
	.primary { width: 100%; padding: 0.85rem 1.25rem; font-weight: 600; font-size: 1.05rem; }
	.secondary { background: transparent; color: var(--text); border-color: var(--line); }
	.tools { display: flex; align-items: center; gap: 0.6rem; }
	.langs { display: flex; gap: 0.25rem; }
	.lang { margin: 0; font-family: var(--mono); font-size: 0.75rem; padding: 0.25rem 0.55rem; background: transparent; color: var(--text-2); border: 1px solid var(--line); border-radius: 999px; }
	.lang.on { background: var(--cta-bg); color: var(--cta-text); border-color: var(--cta-bg); }
	.ghost { margin: 0; background: transparent; color: var(--text); border-color: var(--line); padding: 0.4rem 0.9rem; font-size: 0.9rem; }
	.quiet { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; border-radius: 0; font-size: 0.9rem; }
	textarea, input { width: 100%; }
	label { display: block; margin: 0.5rem 0; font-size: 0.9rem; color: var(--text-2); }
	.tech h2 { margin: 0; }
	.purpose { color: var(--text-2); font-size: 0.9rem; margin: 0.25rem 0 0.5rem; }
	.part { border-top: 1px solid var(--line); padding: 0.6rem 0; }
	.part > summary { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 600; }
	.part[open] > summary { margin-bottom: 0.5rem; }
	.part > summary { list-style: none; }
	/* Inside a fold the parts lose their own card frame: one card, "Technisch". */
	.part > :global(:is(.balances, .vms, .setup)) { margin: 0; padding: 0.25rem 0 0; border: 0; box-shadow: none; background: transparent; }
	.part > :global(:is(.balances, .vms, .setup) > h2) { font-size: 1rem; }
	.part > summary::-webkit-details-marker { display: none; }
	.part > summary > span:first-child::before { content: '▸'; display: inline-block; width: 1.1em; color: var(--text-2); }
	.part[open] > summary > span:first-child::before { content: '▾'; }
	.chip { font-size: 0.8rem; font-weight: 500; padding: 0.1rem 0.6rem; border-radius: 999px; background: var(--surface-2); color: var(--text-2); white-space: nowrap; }
	.chip.warn { background: var(--warn-bg); color: var(--warn); }
	.fold { margin: 0.75rem 0 0; color: var(--text-2); font-size: 0.95rem; }
	.fold[open] summary { margin-bottom: 0.5rem; }
	.phrase ol { columns: 2; font-family: var(--mono); padding-left: 2rem; }
	.hint { color: var(--text-2); font-size: 0.9rem; }
	.error { color: var(--danger); background: var(--danger-bg); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); }
	.warn { color: var(--warn); background: var(--warn-bg); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); margin: 0.5rem 0 0; font-size: 0.9rem; }
	code { word-break: break-all; }
	.stack { display: flex; flex-direction: column; }
	.stack:not(.simple) .pkg { order: -1; }
	.stack:not(.simple) .glance { order: -2; }
	.glance h2 { margin: 0 0 0.25rem; font-size: 1.15rem; }
	.glance ul { list-style: none; margin: 0; padding: 0; }
	.glance li { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-top: 1px solid var(--line); }
	.glance li:first-child { border-top: 0; }
	.glance a { color: var(--text); }
	.glance .chip { overflow: hidden; text-overflow: ellipsis; max-width: 60%; }
	.chip.ok { background: var(--ok-bg); color: var(--ok); }
	:is(#paperless, #paket, #technisch) { scroll-margin-top: 1rem; }
	.tabs { display: flex; gap: 0.25rem; padding: 0.25rem; margin: 0 0 1rem; background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; }
	.tabs button { flex: 1; margin: 0; padding: 0.45rem 0.75rem; background: transparent; color: var(--text-2); border-color: transparent; font-size: 0.95rem; }
	.tabs button.on { background: var(--surface); color: var(--text); border-color: var(--line); font-weight: 600; box-shadow: var(--shadow); }
	.money p { margin: 0; }
	.money .line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem; }
	.money .data { font-size: 1.05rem; font-weight: 500; color: var(--text); }
	.money .label { color: var(--text-2); }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
