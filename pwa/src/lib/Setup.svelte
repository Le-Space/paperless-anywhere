<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import { loadProfile, saveProfile } from '$lib/profile.js';
	import { ageIdentityFromMaster, ageRecipient } from '$lib/keys/age.js';
	import { backupConfigFor } from '$lib/backups.js';
	import {
		connectPayer,
		isAuthorized,
		readAuthorizations,
		sessionKeyAddress,
		sessionKeyExpiry,
		setAlephAuthorization,
		setFilecoinSessionKey
	} from '$lib/permissions.js';

	/** @type {{ master: Uint8Array, onsaved?: () => void }} */
	let { master, onsaved = () => {} } = $props();

	const pwaAddress = privateKeyToAccount(alephPrivateKey(master)).address;
	const sessionAddress = sessionKeyAddress(master);

	/** @type {Record<string, any>} */
	let profile = $state({});
	let loaded = $state(false);
	let alephOk = $state(false);
	let sessionUntil = $state(0n);
	let relayInput = $state('');
	let ageInput = $state('');
	let imageInput = $state('');
	let ownerInput = $state('');
	let passInput = $state('');
	let crnInput = $state('');
	let error = $state('');
	// Which action is running: only that one is blocked. Wallet actions share
	// 'wallet', since MetaMask answers one request at a time.
	let busy = $state('');

	async function refresh() {
		if (profile.payer) {
			alephOk = isAuthorized(await readAuthorizations(profile.payer), pwaAddress);
			sessionUntil = await sessionKeyExpiry(profile.payer, sessionAddress, profile.network ?? 'calibration').catch(() => 0n);
		}
	}

	$effect(() => {
		loadProfile(master)
			.then(async (p) => {
				profile = { network: 'calibration', ...p };
				relayInput = profile.attestRelay ?? '';
				imageInput = profile.rootfsItemHash ?? '';
				ownerInput = profile.backupOwner ?? '';
				crnInput = profile.crnHash ?? '';
				loaded = true;
				await refresh();
			})
			.catch((e) => (error = e.message));
	});

	async function run(key, fn) {
		error = '';
		busy = key;
		try {
			await fn();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = '';
		}
	}
	const save = async (patch) => {
		profile = { ...profile, ...patch };
		await saveProfile(master, $state.snapshot(profile));
		onsaved();
	};

	const connect = () => run('wallet', async () => {
		await save({ payer: await connectPayer() });
		await refresh();
	});
	const authorize = (revoke = false) => run('wallet', async () => {
		await setAlephAuthorization(profile.payer, pwaAddress, { revoke });
		alephOk = !revoke;
	});
	const session = (revoke = false) => run('wallet', async () => {
		await setFilecoinSessionKey(profile.payer, sessionAddress, profile.network, { days: 30, revoke });
		await refresh();
	});
	const saveRelay = () => run('relay', async () => {
		const url = relayInput.trim();
		// wss:// for a real relay; ws:// only to this machine (a relay beside a test).
		if (!/^(wss:\/\/[A-Za-z0-9.-]+(:[0-9]+)?|ws:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?)\/attest$/.test(url)) throw new Error('Erwartet: wss://<host>/attest');
		await save({ attestRelay: url });
	});
	const saveAge = () => run('age', async () => {
		const line = ageInput.split('\n').map((l) => l.trim()).find((l) => l.startsWith('AGE-SECRET-KEY-'));
		if (!line || !/^AGE-SECRET-KEY-1[0-9A-Z]{58}$/.test(line)) throw new Error('Kein gültiger age-Schlüssel (AGE-SECRET-KEY-1…).');
		await save({ ageIdentity: line, ...(profile.backupConfig ? { backupConfig: backupConfigFor(profile.network, ageRecipient(line)) } : {}) });
		ageInput = '';
	});
	// The vault's own key, derived from the master secret: the 24 words alone
	// decrypt every backup made with it. Only its recipient is ever shown.
	const vaultAge = $derived(ageIdentityFromMaster(master));
	const useVaultAge = () => run('age', async () => {
		if (profile.ageIdentity && profile.ageIdentity !== vaultAge && !confirm('Den eingefügten Schlüssel durch den des Tresors ersetzen? Sicherungen, die mit dem alten verschlüsselt sind, brauchen dann weiterhin den alten.')) return;
		await save({ ageIdentity: vaultAge, ...(profile.backupConfig ? { backupConfig: backupConfigFor(profile.network, ageRecipient(vaultAge)) } : {}) });
	});
	// Without a key yet, backups use the vault's own: the default.
	const toggleBackups = (on) => run('backups', async () => {
		const identity = profile.ageIdentity || vaultAge;
		await save(on ? { ageIdentity: identity, backupConfig: backupConfigFor(profile.network, ageRecipient(identity)) } : { backupConfig: null });
	});
	const recipient = $derived.by(() => {
		try {
			return profile.ageIdentity ? ageRecipient(profile.ageIdentity) : '';
		} catch {
			return '';
		}
	});
	const saveOwner = () => run('owner', async () => {
		const owner = ownerInput.trim();
		if (owner && !/^0x[0-9a-fA-F]{40}$/.test(owner)) throw new Error('Eine Adresse (0x…, 40 Zeichen).');
		await save({ backupOwner: owner || null });
	});
	const saveImage = () => run('image', async () => {
		const image = imageInput.trim().toLowerCase();
		const crn = crnInput.trim().toLowerCase();
		if (!/^[0-9a-f]{64}$/.test(image)) throw new Error('Das Image ist ein 64-stelliger Hash.');
		if (!/^[0-9a-f]{64}$/.test(crn)) throw new Error('Der Knoten ist ein 64-stelliger Hash.');
		// A pasted passphrase may carry a stray space or line break; the guest only
		// finds out when it opens the disk, and then waits without a word.
		const pass = passInput.trim();
		await save({ rootfsItemHash: image, crnHash: crn, ...(pass ? { luksPassphrase: pass } : {}) });
		passInput = '';
	});
	const until = (s) => (s > 0n && Number(s) * 1000 > Date.now() ? new Date(Number(s) * 1000).toLocaleDateString('de-DE') : '');
</script>

<section class="setup" data-testid="setup">
	<h2>Einrichtung</h2>
	{#if busy === 'wallet'}<p class="waiting" data-testid="wallet-waiting">Warte auf MetaMask … (bitte dort bestätigen oder ablehnen)</p>{/if}
	{#if !loaded}
		<p>Lade Einstellungen …</p>
	{:else}
		<label>
			Netz
			<select value={profile.network} onchange={(e) => run('network', async () => { await save({ network: e.currentTarget.value }); await refresh(); })} disabled={busy === 'wallet'}>
				<option value="calibration">Test (Calibration)</option>
				<option value="mainnet">Produktiv (Mainnet)</option>
			</select>
		</label>

		<h3>1. Zahlendes Konto</h3>
		{#if profile.payer}
			<p>Verbunden: <code data-testid="payer">{profile.payer}</code>
				<br /><small class="money">Hier liegt das Geld: Aleph-Credits für die VMs, im Testnetz tFIL und USDFC für die Sicherungen. Der Schlüssel dazu bleibt in deinem Wallet; diese App sieht ihn nie.</small></p>
		{/if}
		<button onclick={connect} disabled={busy === 'wallet'}>{profile.payer ? 'Anderes Konto verbinden' : 'Wallet verbinden'}</button>

		{#if profile.payer}
			<h3>2. Aleph: diese App darf VMs starten und löschen</h3>
			<p>App-Schlüssel: <code>{pwaAddress}</code>
				<br /><small class="nomoney">Hält kein Geld – nichts dorthin überweisen. Er darf nur im Auftrag des zahlenden Kontos VMs starten und löschen.</small></p>
			<p data-testid="aleph-status">{alephOk ? 'freigegeben (INSTANCE, FORGET, Port-Freigaben)' : 'nicht freigegeben'}</p>
			{#if alephOk}
				<button onclick={() => authorize(true)} disabled={busy === 'wallet'}>Freigabe zurücknehmen</button>
			{:else}
				<button onclick={() => authorize()} disabled={busy === 'wallet'}>Im Wallet freigeben</button>
			{/if}

			<h3>3. Filecoin: Sicherungen hinzufügen</h3>
			<p>Sitzungsschlüssel: <code>{sessionAddress}</code>
				<br /><small class="nomoney">Hält kein Geld – nichts dorthin überweisen. Er darf 30 Tage lang Sicherungen hinzufügen, bezahlt vom zahlenden Konto.</small></p>
			<p data-testid="session-status">{until(sessionUntil) ? `gültig bis ${until(sessionUntil)}` : 'nicht freigegeben'}</p>
			<button onclick={() => session()} disabled={busy === 'wallet'}>{until(sessionUntil) ? 'Um 30 Tage verlängern' : 'Für 30 Tage freigeben'}</button>
			{#if until(sessionUntil)}<button onclick={() => session(true)} disabled={busy === 'wallet'}>Zurücknehmen</button>{/if}
		{/if}

		<h3>4. Attest-Relay</h3>
		<label>Adresse des Relays<input bind:value={relayInput} placeholder="wss://dein-relay.example/attest" /></label>
		<button onclick={saveRelay} disabled={busy === 'relay'}>Relay speichern</button>

		<h3>5. Sicherungen</h3>
		<label>Wallet, dem die Sicherungen gehören (0x…, leer = zahlendes Konto)<input bind:value={ownerInput} placeholder={profile.payer ? `Wallet der Sicherungen (leer = ${profile.payer.slice(0, 10)}…)` : 'Wallet der Sicherungen'} /></label>
		<button onclick={saveOwner} disabled={busy === 'owner'}>Wallet der Sicherungen speichern</button>
		<p>Schlüssel der Sicherungen (age): die VM verschlüsselt jede Sicherung für ihn, eine Wiederherstellung braucht ihn.</p>
		<p data-testid="age-status">{!profile.ageIdentity ? 'nicht hinterlegt' : profile.ageIdentity === vaultAge ? 'der Schlüssel des Tresors (die 24 Wörter genügen zur Wiederherstellung)' : 'eingefügt (nicht aus dem Tresor: getrennt aufbewahren!)'}</p>
		{#if recipient}<p><small>Empfänger: <code data-testid="age-recipient">{recipient}</code></small></p>{/if}
		{#if profile.ageIdentity !== vaultAge}<button onclick={useVaultAge} disabled={busy === 'age'}>Schlüssel des Tresors verwenden (empfohlen)</button>{/if}
		<details>
			<summary>Einen vorhandenen Schlüssel einfügen</summary>
			<textarea bind:value={ageInput} rows="2" autocomplete="off" spellcheck="false" placeholder="AGE-SECRET-KEY-1…"></textarea>
			<button onclick={saveAge} disabled={busy === 'age' || !ageInput.trim()}>Versiegelt hinterlegen</button>
		</details>
		<label class="check">
			<input type="checkbox" data-testid="backups-on" checked={!!profile.backupConfig} disabled={busy === 'backups' || profile.network !== 'calibration'}
				onchange={(e) => toggleBackups(e.currentTarget.checked)} />
			Beim Stoppen sichern (Testnetz: 2 Kopien, Datensatz <code>paperless-backup-test</code>)
		</label>
		{#if profile.network !== 'calibration'}<p class="hint">Im Hauptnetz sichert vorerst nur der Mac; aus der App erst nach dem Test.</p>
		{:else if profile.backupConfig && !until(sessionUntil)}<p class="hint">Dafür braucht die VM den Sitzungsschlüssel aus Schritt 3.</p>{/if}

		<h3>6. Paperless-Image und Knoten</h3>
		<label>Image (STORE-Hash, 64 Zeichen)<input bind:value={imageInput} placeholder="Image (STORE-Hash)" /></label>
		<label>SEV-SNP-Knoten (Hash, 64 Zeichen)<input bind:value={crnInput} placeholder="SEV-SNP-Knoten (Hash)" /></label>
		<label>Passphrase des Images<input bind:value={passInput} type="password" autocomplete="off" placeholder={profile.luksPassphrase ? `Passphrase hinterlegt, ${profile.luksPassphrase.length} Zeichen (leer lassen = behalten)` : 'Passphrase des Images'} /></label>
		<button onclick={saveImage} disabled={busy === 'image'}>Image und Knoten speichern</button>
	{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.setup { margin-top: 2rem; border-top: 1px solid #ddd; }
	h3 { margin-top: 1.5rem; font-size: 1rem; }
	select, input, textarea { width: 100%; font-size: 1rem; }
	button { display: block; margin: 0.5rem 0; padding: 0.5rem 1rem; font-size: 1rem; }
	code { word-break: break-all; }
	label.check { display: flex; gap: 0.5rem; align-items: baseline; color: #000; font-size: 1rem; }
	label.check input { width: auto; }
	.money { color: #2e7d32; }
	.nomoney { color: #b26a00; }
	.hint { color: #666; font-size: 0.9rem; }
	label { display: block; margin-top: 0.5rem; font-size: 0.9rem; color: #444; }
	.waiting { background: #fff4d6; padding: 0.5rem 0.75rem; border-radius: 4px; }
	.error { color: #b00020; }
</style>
