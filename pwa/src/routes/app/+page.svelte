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
	import { HOME, sharedOrigin } from '$lib/shared-origin.js';

	// On a path-style gateway the origin is shared: no vault, no passkey there.
	const shared = sharedOrigin();
	let vault = $state(shared ? null : loadVault());
	/** @type {Uint8Array | null} the master secret, in memory only */
	let master = $state(null);
	let phrase = $state('');
	let shownPhrase = $state('');
	let name = $state('Paperless');
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
		await addPasskey(/** @type {Uint8Array} */ (master), `${name.trim() || 'Paperless'} (${location.host})`);
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
		const result = await createVault(name.trim() || 'Paperless');
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
	/** @type {{ money: string, lasts: string, warnings: ('start' | 'backups')[] } | null} */
	let summary = $state(null);
</script>

<!-- Its own title: coming from the landing page, the tab would keep that one. -->
<svelte:head>
	<title>Paperless anywhere</title>
</svelte:head>

<header class="top">
	<div class="bar">
		<Logo />
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
		<section class="card hero">
			<h1>Paperless öffnen</h1>
			<p class="lede">Deine Belege in Paperless, auf einer eigenen, verschlüsselten Maschine. Zum Öffnen brauchst du deinen Passkey.</p>
			<button class="primary" onclick={unlockPasskey} disabled={busy || passkeyWaiting}>Auf diesem Gerät mit Passkey öffnen</button>
			{#if passkeyWaiting}<p class="hint" data-testid="passkey-waiting">Warte auf den Passkey … Gibt es für {location.host} noch keinen, mit den 24 Wörtern öffnen.</p>{/if}
			<details class="fold">
				<summary>Auf diesem Gerät mit Wiederherstellungsphrase öffnen</summary>
				<textarea bind:value={phrase} rows="3" autocomplete="off" spellcheck="false"></textarea>
				<button class="secondary" onclick={unlockPhrase} disabled={busy || !phrase.trim()}>Öffnen</button>
			</details>
		</section>
		<section class="card">
			<h2>Neu einrichten</h2>
			<p class="hint">Ein Passkey schützt den Zugang. Dazu bekommst du eine Wiederherstellungsphrase aus 24 Wörtern.</p>
			<label>Name des Passkeys <input bind:value={name} /></label>
			<button class="secondary" onclick={create} disabled={busy}>Passkey anlegen</button>
		</section>
	{:else if state === 'locked'}
		<section class="card hero">
			<h1>Willkommen zurück</h1>
			<p class="lede">Entsperre mit deinem Passkey, dann siehst du, ob Paperless läuft.</p>
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
				<p>Schreib sie auf Papier und bewahre sie sicher auf. Sie wird nur jetzt angezeigt.</p>
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
		<div class="advanced" hidden={simple || !!shownPhrase}>
			<section class="card">
				<p>Entsperrt. Schlüssel dieser App für Aleph: <code data-testid="address">{address}</code>
					<br /><small class="hint">Geld liegt hier nur, wenn die App ihre VMs selbst bezahlt (Einrichtung, Schritt 1); sonst beim zahlenden Konto.</small></p>
				<details class="fold">
					<summary>Weiteren Passkey hinzufügen</summary>
					<p class="hint">Ein Passkey gehört zu einer Adresse ({location.host}). Für die gehostete App oder ein zweites Gerät: dort mit den 24 Wörtern öffnen und hier einen Passkey anlegen. Jeder Passkey öffnet denselben Tresor.</p>
					<button class="secondary" onclick={newPasskey} disabled={busy}>Passkey für {location.host} anlegen</button>
					{#if added}<p data-testid="passkey-added">Neuer Passkey für {added} angelegt; dieser Browser nutzt ihn ab jetzt.</p>{/if}
				</details>
			</section>
		</div>
		{#if !shownPhrase}
			<div class="advanced" hidden={simple}><Balances {master} version={profileVersion} onsummary={(s) => (summary = s)} /></div>
			<Lifecycle {master} {simple} version={profileVersion} onchange={() => profileVersion++} onadvanced={() => showTab('advanced')} />
			<!-- With Le Space Credits a customer sees the package and euros only; Aleph
			     and Filecoin balances stay under "Erweitert". -->
			{#if CREDITS_URL}<Package {master} version={profileVersion} />{/if}
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
			<div class="advanced" hidden={simple}><VmList {master} version={profileVersion} onchange={() => profileVersion++} /><Setup {master} onsaved={() => profileVersion++} /></div>
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
	button { display: block; margin: 0.75rem 0; padding: 0.6rem 1.1rem; font-size: 1rem; }
	.primary { width: 100%; padding: 0.85rem 1.25rem; font-weight: 600; font-size: 1.05rem; }
	.secondary { background: transparent; color: var(--text); border-color: var(--line); }
	.ghost { margin: 0; background: transparent; color: var(--text); border-color: var(--line); padding: 0.4rem 0.9rem; font-size: 0.9rem; }
	.quiet { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; border-radius: 0; font-size: 0.9rem; }
	textarea, input { width: 100%; }
	label { display: block; margin: 0.5rem 0; font-size: 0.9rem; color: var(--text-2); }
	.fold { margin: 0.75rem 0 0; color: var(--text-2); font-size: 0.95rem; }
	.fold[open] summary { margin-bottom: 0.5rem; }
	.phrase ol { columns: 2; font-family: var(--mono); padding-left: 2rem; }
	.hint { color: var(--text-2); font-size: 0.9rem; }
	.error { color: var(--danger); background: var(--danger-bg); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); }
	.warn { color: var(--warn); background: var(--warn-bg); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); margin: 0.5rem 0 0; font-size: 0.9rem; }
	code { word-break: break-all; }
	.tabs { display: flex; gap: 0.25rem; padding: 0.25rem; margin: 0 0 1rem; background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; }
	.tabs button { flex: 1; margin: 0; padding: 0.45rem 0.75rem; background: transparent; color: var(--text-2); border-color: transparent; font-size: 0.95rem; }
	.tabs button.on { background: var(--surface); color: var(--text); border-color: var(--line); font-weight: 600; box-shadow: var(--shadow); }
	.money p { margin: 0; }
	.money .line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem; }
	.money .data { font-size: 1.05rem; font-weight: 500; color: var(--text); }
	.money .label { color: var(--text-2); }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
