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
	// The landing page, on the same origin; it shows the language chosen there.
	const LANDING = '/';
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
		if (state === 'unlocked' && acting && !confirm('Die App wird beim Wechsel zur Startseite gesperrt. Gerade läuft noch etwas (Start, Sicherung oder Stopp); die VM macht weiter, die App verfolgt es aber erst wieder, wenn du sie neu entsperrst. Trotzdem wechseln?')) event.preventDefault();
	}
	function lock() {
		master?.fill(0);
		master = null;
		shownPhrase = '';
	}
	function reset() {
		if (!confirm('Diesen Tresor in diesem Browser vergessen? Mit der Wiederherstellungsphrase lässt er sich neu öffnen.')) return;
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
	const PAYS = { lespace: 'Le Space, aus dem Paket', app: 'Adresse der App', wallet: 'Meine Wallet' };
	const when = (/** @type {string} */ at) => new Date(at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	const glance = $derived([
		...(CREDITS_URL && pkg ? [{ id: 'paket', label: 'Paket', state: !pkg.plan ? 'kein Paket' : pkg.pays === 'app' || pkg.pays === 'wallet' ? 'nicht in Gebrauch' : pkg.hoursLeft != null ? `${pkg.hoursLeft} h übrig` : 'aktiv', tone: !pkg.plan || pkg.low ? 'warn' : pkg.pays === 'app' || pkg.pays === 'wallet' ? '' : 'ok' }] : []),
		...(life ? [
			{ id: 'paperless', label: 'Paperless-ngx', state: { off: 'aus', running: 'läuft', starting: 'startet', stopping: 'wird beendet', interrupted: 'Start unterbrochen', loading: '…' }[life.phase] ?? life.phase, tone: life.phase === 'running' ? 'ok' : life.phase === 'interrupted' ? 'warn' : '' },
			{ id: 'paperless', label: 'Sicherungen', state: !life.backupsOn ? 'aus' : life.lastGood ? `${when(life.lastGood.at)}${life.lastGood.copies ? ` · ${life.lastGood.copies} Kopien` : ''}` : 'noch keine', tone: !life.backupsOn || !life.lastGood ? 'warn' : 'ok' },
			{ id: 'technisch', label: 'Adresse', state: life.host ?? (life.fixedHost ? 'feste Adresse' : 'neu bei jedem Start'), tone: '' },
			{ id: 'technisch', label: 'Zahlweg', state: life.pays ? PAYS[life.pays] : 'noch nicht gewählt', tone: life.pays ? '' : 'warn' }
		] : [])
	]);
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
		<Logo href={LANDING} label={state === 'unlocked' ? 'Zur Startseite (die App wird dabei gesperrt)' : 'Zur Startseite'} onnavigate={leave}>{#snippet sub()}<NgxText text={texts.de.tagline} link />{/snippet}</Logo>
		{#if state === 'unlocked'}<button class="ghost" onclick={lock}>Sperren</button>{/if}
	</div>
</header>

<main>
	<p class="sr-only" data-testid="state">{shared ? 'shared origin' : state}</p>

	{#if shared}
		<section class="card">
			<p data-testid="shared-origin">Diese Adresse teilen sich alle Seiten dieses IPFS-Gateways, auch ihr Speicher und ihre Passkeys. Den Tresor öffnet die App hier nicht.
				Bitte unter <a href={HOME}>{HOME}</a> öffnen.</p>
		</section>
	{:else if state === 'new'}
		<!-- Coming from the landing page most people have no vault yet: creating
		     one comes first, opening an existing one second. -->
		<section class="card hero">
			<h1>Neu hier? Tresor anlegen</h1>
			<p class="lede">Deine Dokumente in Paperless-ngx, auf einer eigenen, verschlüsselten Maschine. Ein Passkey auf diesem Gerät öffnet deinen Tresor; dazu bekommst du 24 Wörter zum Aufschreiben.</p>
			<div class="risk" data-testid="key-loss">
				<p><strong>Nur du hast den Schlüssel.</strong> Le Space kann deinen Tresor weder öffnen noch wiederherstellen. Sind Passkey und die 24 Wörter weg, sind deine Dokumente und alle Sicherungen verloren.</p>
				<label class="check"><input type="checkbox" bind:checked={understood} data-testid="key-loss-ok" /> Verstanden: Ich bewahre die 24 Wörter sicher auf, auf Papier und nicht auf diesem Gerät.</label>
			</div>
			<button class="primary" onclick={create} disabled={busy || !understood}>Passkey anlegen</button>
			<details class="fold">
				<summary>Name des Passkeys ändern</summary>
				<label>Name des Passkeys <input bind:value={name} /></label>
			</details>
		</section>
		<section class="card">
			<h2>Schon einen Tresor?</h2>
			<button class="secondary" onclick={unlockPasskey} disabled={busy || passkeyWaiting}>Auf diesem Gerät mit Passkey öffnen</button>
			{#if passkeyWaiting}<p class="hint" data-testid="passkey-waiting">Warte auf den Passkey … Gibt es für {location.host} noch keinen, mit den 24 Wörtern öffnen.</p>{/if}
			<details class="fold">
				<summary>Auf diesem Gerät mit Wiederherstellungsphrase öffnen</summary>
				<textarea bind:value={phrase} rows="3" autocomplete="off" spellcheck="false"></textarea>
				<button class="secondary" onclick={unlockPhrase} disabled={busy || !phrase.trim()}>Öffnen</button>
			</details>
		</section>
	{:else if state === 'locked'}
		<section class="card hero">
			<h1>Willkommen zurück</h1>
			<p class="lede">Entsperre mit deinem Passkey, dann siehst du, ob Paperless-ngx läuft.</p>
			<button class="primary" onclick={unlockPasskey} disabled={busy || passkeyWaiting}>Mit Passkey entsperren</button>
			{#if passkeyWaiting}<p class="hint" data-testid="passkey-waiting">Warte auf den Passkey …</p>{/if}
			<details class="fold">
				<summary>Mit Wiederherstellungsphrase entsperren</summary>
				<textarea bind:value={phrase} rows="3" autocomplete="off" spellcheck="false"></textarea>
				<button class="secondary" onclick={unlockPhrase} disabled={busy || !phrase.trim()}>Entsperren</button>
			</details>
			<button class="quiet" onclick={reset}>Diesen Browser vergessen</button>
		</section>
	{:else}
		{#if shownPhrase}
			<section class="card phrase">
				<h2>Wiederherstellungsphrase</h2>
				<p>Schreib sie auf Papier und bewahre sie sicher auf, nicht auf diesem Gerät. Sie wird nur jetzt angezeigt. Mit ihr öffnest du den Tresor auf jedem Gerät, auch wenn der Passkey verloren ist; ohne sie und ohne Passkey hilft dir niemand, auch Le Space nicht.</p>
				{#if !confirming}
					<ol data-testid="phrase">{#each shownPhrase.split(' ') as word}<li>{word}</li>{/each}</ol>
					<button class="primary" onclick={startConfirm}>Aufgeschrieben</button>
				{:else}
					<p>Zur Probe, von deinem Zettel:</p>
					{#each askPositions as position, i (position)}
						<label>Wort {position + 1} <input bind:value={answers[i]} autocomplete="off" spellcheck="false" data-testid={`confirm-${position + 1}`} /></label>
					{/each}
					<button class="primary" onclick={doneConfirm} disabled={!answered}>Stimmt</button>
					<button class="quiet" onclick={() => (confirming = false)}>Wörter noch einmal zeigen</button>
				{/if}
			</section>
		{:else}
			<div class="tabs" role="tablist" aria-label="Ansicht">
				<button role="tab" aria-selected={simple} class:on={simple} onclick={() => showTab('simple')} data-testid="tab-simple">Übersicht</button>
				<button role="tab" aria-selected={!simple} class:on={!simple} onclick={() => showTab('advanced')} data-testid="tab-advanced">Erweitert</button>
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
						<h2>Auf einen Blick</h2>
						<ul>
							{#each glance as row (row.label)}
								<li><a href={`#${row.id}`}>{row.label}</a><span class="chip {row.tone}" data-testid={`glance-${row.label}`}>{row.state}</span></li>
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
			<h2>Technisch</h2>
			<p class="purpose">Für Fortgeschrittene. Für den Alltag ist nichts davon nötig.</p>
			<details class="part" data-testid="tech-keys">
				<summary><span>Schlüssel und Passkeys</span></summary>
				<p>Entsperrt. Schlüssel dieser App für Aleph: <code data-testid="address">{address}</code>
					<br /><small class="hint">Dein Browser leitet diesen Schlüssel aus deinem Passkey (oder den 24 Wörtern) ab; Le Space hat ihn nicht. Aleph-Credits liegen hier nur, wenn du deine VMs selbst über diese Adresse bezahlst (Einrichtung, Schritt 1).</small></p>
				<details class="fold">
					<summary>Weiteren Passkey hinzufügen</summary>
					<p class="hint">Ein Passkey gehört zu einer Adresse ({location.host}). Für die gehostete App oder ein zweites Gerät: dort mit den 24 Wörtern öffnen und hier einen Passkey anlegen. Jeder Passkey öffnet denselben Tresor.</p>
					<button class="secondary" onclick={newPasskey} disabled={busy}>Passkey für {location.host} anlegen</button>
					{#if added}<p data-testid="passkey-added">Neuer Passkey für {added} angelegt; dieser Browser nutzt ihn ab jetzt.</p>{/if}
				</details>
			</details>
			{#if !shownPhrase}
				<!-- Only where the person pays with crypto themselves; Balances still reads the start warning otherwise. -->
				<details class="part" data-testid="tech-balances" hidden={!balancesShown}>
					<summary><span>Deine Wallet bei Aleph und Filecoin</span>{#if summary?.money}<span class="chip">{summary.money}</span>{/if}</summary>
					<Balances {master} version={profileVersion} onsummary={(s) => (summary = s)} onshown={(v) => (balancesShown = v)} />
				</details>
				<details class="part" data-testid="tech-vms">
					<summary><span>Meine VMs</span></summary>
					<VmList {master} version={profileVersion} onchange={() => profileVersion++} />
				</details>
				<details class="part" bind:open={setupOpen} data-testid="tech-setup">
					<summary><span>Einrichtung</span><span class="chip" class:warn={missing.length > 0}>{missing.length ? 'es fehlt etwas' : 'vollständig'}</span></summary>
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
						<p class="line"><span class="label">Guthaben</span> <span class="data">{summary.money}</span>{#if summary.lasts}<span class="hint">reicht ca. {summary.lasts}</span>{/if}</p>
					</section>
				{/if}
				{#each summary.warnings as w (w)}
					<p class="warn" role="status" data-testid={`simple-warning-${w}`}>{w === 'start'
						? (CREDITS_URL ? 'Für einen Start reicht es gerade nicht: ein Paket wählen oder Stunden dazukaufen.' : 'Für einen Start reicht das Guthaben gerade nicht. Details unter „Erweitert“.')
						: 'Das Guthaben für die Sicherungen geht bald zu Ende. Details unter „Erweitert“.'}</p>
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
