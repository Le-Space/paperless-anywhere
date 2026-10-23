<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import { addPasskey, confirmationPositions, createVault, forgetVault, loadVault, unlockWithPasskey, unlockWithSeedPhrase } from '$lib/keys/vault.js';
	import Setup from '$lib/Setup.svelte';
	import Lifecycle from '$lib/Lifecycle.svelte';
	import Balances from '$lib/Balances.svelte';
	import VmList from '$lib/VmList.svelte';
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
</script>

<main>
	<h1>Paperless anywhere</h1>
	<p class="state" data-testid="state">{shared ? 'shared origin' : state}</p>

	{#if shared}
		<p data-testid="shared-origin">Diese Adresse teilen sich alle Seiten dieses IPFS-Gateways, auch ihr Speicher und ihre Passkeys. Den Tresor öffnet die App hier nicht.
			Bitte unter <a href={HOME}>{HOME}</a> öffnen.</p>
	{:else if state === 'new'}
		<p>Ein Passkey schützt den Zugang. Dazu bekommst du eine Wiederherstellungsphrase aus 24 Wörtern.</p>
		<label>Name des Passkeys <input bind:value={name} /></label>
		<button onclick={create} disabled={busy}>Passkey anlegen</button>
		<h2>Schon eingerichtet?</h2>
		<button onclick={unlockPasskey} disabled={busy || passkeyWaiting}>Auf diesem Gerät mit Passkey öffnen</button>
		{#if passkeyWaiting}<p class="state" data-testid="passkey-waiting">Warte auf den Passkey … Gibt es für {location.host} noch keinen, mit den 24 Wörtern öffnen.</p>{/if}
		<details>
			<summary>Auf diesem Gerät mit Wiederherstellungsphrase öffnen</summary>
			<textarea bind:value={phrase} rows="3" autocomplete="off" spellcheck="false"></textarea>
			<button onclick={unlockPhrase} disabled={busy || !phrase.trim()}>Öffnen</button>
		</details>
	{:else if state === 'locked'}
		<button onclick={unlockPasskey} disabled={busy || passkeyWaiting}>Mit Passkey entsperren</button>
		{#if passkeyWaiting}<p class="state" data-testid="passkey-waiting">Warte auf den Passkey …</p>{/if}
		<details>
			<summary>Mit Wiederherstellungsphrase entsperren</summary>
			<textarea bind:value={phrase} rows="3" autocomplete="off" spellcheck="false"></textarea>
			<button onclick={unlockPhrase} disabled={busy || !phrase.trim()}>Entsperren</button>
		</details>
		<button class="quiet" onclick={reset}>Diesen Browser vergessen</button>
	{:else}
		{#if shownPhrase}
			<section class="phrase">
				<h2>Wiederherstellungsphrase</h2>
				<p>Schreib sie auf Papier und bewahre sie sicher auf. Sie wird nur jetzt angezeigt.</p>
				{#if !confirming}
					<ol data-testid="phrase">{#each shownPhrase.split(' ') as word}<li>{word}</li>{/each}</ol>
					<button onclick={startConfirm}>Aufgeschrieben</button>
				{:else}
					<p>Zur Probe, von deinem Zettel:</p>
					{#each askPositions as position, i (position)}
						<label>Wort {position + 1} <input bind:value={answers[i]} autocomplete="off" spellcheck="false" data-testid={`confirm-${position + 1}`} /></label>
					{/each}
					<button onclick={doneConfirm} disabled={!answered}>Stimmt</button>
					<button class="quiet" onclick={() => (confirming = false)}>Wörter noch einmal zeigen</button>
				{/if}
			</section>
		{/if}
		<p>Entsperrt. Schlüssel dieser App für Aleph: <code data-testid="address">{address}</code>
			<br /><small>Er hält kein Geld: nichts dorthin überweisen. Das Geld liegt beim zahlenden Konto (Einrichtung, Schritt 1).</small></p>
		<button onclick={lock}>Sperren</button>
		{#if !shownPhrase}
			<details class="passkeys">
				<summary>Weiteren Passkey hinzufügen</summary>
				<p>Ein Passkey gehört zu einer Adresse ({location.host}). Für die gehostete App oder ein zweites Gerät: dort mit den 24 Wörtern öffnen und hier einen Passkey anlegen. Jeder Passkey öffnet denselben Tresor.</p>
				<button onclick={newPasskey} disabled={busy}>Passkey für {location.host} anlegen</button>
				{#if added}<p data-testid="passkey-added">Neuer Passkey für {added} angelegt; dieser Browser nutzt ihn ab jetzt.</p>{/if}
			</details>
		{/if}
		{#if !shownPhrase}<Balances {master} version={profileVersion} /><Lifecycle {master} version={profileVersion} onchange={() => profileVersion++} /><VmList {master} version={profileVersion} onchange={() => profileVersion++} /><Setup {master} onsaved={() => profileVersion++} />{/if}
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}
</main>

<style>
	main { max-width: 36rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; line-height: 1.5; }
	button { display: block; margin: 0.75rem 0; padding: 0.6rem 1rem; font-size: 1rem; }
	.quiet { background: none; border: none; color: #666; text-decoration: underline; padding: 0; }
	textarea, input { width: 100%; font-size: 1rem; }
	.phrase ol { columns: 2; font-family: ui-monospace, monospace; }
	.passkeys { margin: 1rem 0; }
	label { display: block; margin: 0.4rem 0; }
	.state { color: #666; font-size: 0.9rem; }
	.error { color: #b00020; }
	code { word-break: break-all; }
</style>
