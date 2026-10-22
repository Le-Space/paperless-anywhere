<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import { createVault, forgetVault, loadVault, unlockWithPasskey, unlockWithSeedPhrase } from '$lib/keys/vault.js';
	import Setup from '$lib/Setup.svelte';
	import Lifecycle from '$lib/Lifecycle.svelte';
	import VmList from '$lib/VmList.svelte';

	let vault = $state(loadVault());
	/** @type {Uint8Array | null} the master secret, in memory only */
	let master = $state(null);
	let phrase = $state('');
	let shownPhrase = $state('');
	let name = $state('Paperless');
	let error = $state('');
	let busy = $state(false);
	let profileVersion = $state(0);

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
	const unlockPasskey = () => run(async () => {
		master = await unlockWithPasskey(vault);
		vault = loadVault();
	});
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
	<p class="state" data-testid="state">{state}</p>

	{#if state === 'new'}
		<p>Ein Passkey schützt den Zugang. Dazu bekommst du eine Wiederherstellungsphrase aus 24 Wörtern.</p>
		<label>Name des Passkeys <input bind:value={name} /></label>
		<button onclick={create} disabled={busy}>Passkey anlegen</button>
		<h2>Schon eingerichtet?</h2>
		<button onclick={unlockPasskey} disabled={busy}>Auf diesem Gerät mit Passkey öffnen</button>
		<details>
			<summary>Auf diesem Gerät mit Wiederherstellungsphrase öffnen</summary>
			<textarea bind:value={phrase} rows="3" autocomplete="off" spellcheck="false"></textarea>
			<button onclick={unlockPhrase} disabled={busy || !phrase.trim()}>Öffnen</button>
		</details>
	{:else if state === 'locked'}
		<button onclick={unlockPasskey} disabled={busy}>Mit Passkey entsperren</button>
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
				<ol data-testid="phrase">{#each shownPhrase.split(' ') as word}<li>{word}</li>{/each}</ol>
				<button onclick={() => (shownPhrase = '')}>Aufgeschrieben</button>
			</section>
		{/if}
		<p>Entsperrt. Schlüssel dieser App für Aleph: <code data-testid="address">{address}</code></p>
		<button onclick={lock}>Sperren</button>
		{#if !shownPhrase}<Lifecycle {master} version={profileVersion} onchange={() => profileVersion++} /><VmList {master} version={profileVersion} onchange={() => profileVersion++} /><Setup {master} onsaved={() => profileVersion++} />{/if}
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}
</main>

<style>
	main { max-width: 36rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; line-height: 1.5; }
	button { display: block; margin: 0.75rem 0; padding: 0.6rem 1rem; font-size: 1rem; }
	.quiet { background: none; border: none; color: #666; text-decoration: underline; padding: 0; }
	textarea, input { width: 100%; font-size: 1rem; }
	.phrase ol { columns: 2; font-family: ui-monospace, monospace; }
	.state { color: #666; font-size: 0.9rem; }
	.error { color: #b00020; }
	code { word-break: break-all; }
</style>
