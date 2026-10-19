<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import { loadProfile, saveProfile } from '$lib/profile.js';
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
	let busy = $state(false);

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
	const save = async (patch) => {
		profile = { ...profile, ...patch };
		await saveProfile(master, $state.snapshot(profile));
		onsaved();
	};

	const connect = () => run(async () => {
		await save({ payer: await connectPayer() });
		await refresh();
	});
	const authorize = (revoke = false) => run(async () => {
		await setAlephAuthorization(profile.payer, pwaAddress, { revoke });
		alephOk = !revoke;
	});
	const session = (revoke = false) => run(async () => {
		await setFilecoinSessionKey(profile.payer, sessionAddress, profile.network, { days: 30, revoke });
		await refresh();
	});
	const saveRelay = () => run(async () => {
		const url = relayInput.trim();
		// wss:// for a real relay; ws:// only to this machine (a relay beside a test).
		if (!/^(wss:\/\/[A-Za-z0-9.-]+(:[0-9]+)?|ws:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?)\/attest$/.test(url)) throw new Error('Erwartet: wss://<host>/attest');
		await save({ attestRelay: url });
	});
	const saveAge = () => run(async () => {
		const line = ageInput.split('\n').map((l) => l.trim()).find((l) => l.startsWith('AGE-SECRET-KEY-'));
		if (!line || !/^AGE-SECRET-KEY-1[0-9A-Z]{58}$/.test(line)) throw new Error('Kein gültiger age-Schlüssel (AGE-SECRET-KEY-1…).');
		await save({ ageIdentity: line });
		ageInput = '';
	});
	const saveOwner = () => run(async () => {
		const owner = ownerInput.trim();
		if (owner && !/^0x[0-9a-fA-F]{40}$/.test(owner)) throw new Error('Eine Adresse (0x…, 40 Zeichen).');
		await save({ backupOwner: owner || null });
	});
	const saveImage = () => run(async () => {
		const image = imageInput.trim().toLowerCase();
		const crn = crnInput.trim().toLowerCase();
		if (!/^[0-9a-f]{64}$/.test(image)) throw new Error('Das Image ist ein 64-stelliger Hash.');
		if (!/^[0-9a-f]{64}$/.test(crn)) throw new Error('Der Knoten ist ein 64-stelliger Hash.');
		await save({ rootfsItemHash: image, crnHash: crn, ...(passInput ? { luksPassphrase: passInput } : {}) });
		passInput = '';
	});
	const until = (s) => (s > 0n && Number(s) * 1000 > Date.now() ? new Date(Number(s) * 1000).toLocaleDateString('de-DE') : '');
</script>

<section class="setup" data-testid="setup">
	<h2>Einrichtung</h2>
	{#if !loaded}
		<p>Lade Einstellungen …</p>
	{:else}
		<label>
			Netz
			<select value={profile.network} onchange={(e) => run(async () => { await save({ network: e.currentTarget.value }); await refresh(); })} disabled={busy}>
				<option value="calibration">Test (Calibration)</option>
				<option value="mainnet">Produktiv (Mainnet)</option>
			</select>
		</label>

		<h3>1. Zahlendes Konto</h3>
		{#if profile.payer}
			<p>Verbunden: <code data-testid="payer">{profile.payer}</code></p>
		{/if}
		<button onclick={connect} disabled={busy}>{profile.payer ? 'Anderes Konto verbinden' : 'Wallet verbinden'}</button>

		{#if profile.payer}
			<h3>2. Aleph: diese App darf VMs starten und löschen</h3>
			<p>App-Schlüssel: <code>{pwaAddress}</code></p>
			<p data-testid="aleph-status">{alephOk ? 'freigegeben (INSTANCE, FORGET, Port-Freigaben)' : 'nicht freigegeben'}</p>
			{#if alephOk}
				<button onclick={() => authorize(true)} disabled={busy}>Freigabe zurücknehmen</button>
			{:else}
				<button onclick={() => authorize()} disabled={busy}>Im Wallet freigeben</button>
			{/if}

			<h3>3. Filecoin: Sicherungen hinzufügen</h3>
			<p>Sitzungsschlüssel: <code>{sessionAddress}</code></p>
			<p data-testid="session-status">{until(sessionUntil) ? `gültig bis ${until(sessionUntil)}` : 'nicht freigegeben'}</p>
			<button onclick={() => session()} disabled={busy}>{until(sessionUntil) ? 'Um 30 Tage verlängern' : 'Für 30 Tage freigeben'}</button>
			{#if until(sessionUntil)}<button onclick={() => session(true)} disabled={busy}>Zurücknehmen</button>{/if}
		{/if}

		<h3>4. Attest-Relay</h3>
		<input bind:value={relayInput} placeholder="wss://dein-relay.example/attest" />
		<button onclick={saveRelay} disabled={busy}>Relay speichern</button>

		<h3>5. Sicherungen</h3>
		<input bind:value={ownerInput} placeholder={profile.payer ? `Wallet der Sicherungen (leer = ${profile.payer.slice(0, 10)}…)` : 'Wallet der Sicherungen'} />
		<button onclick={saveOwner} disabled={busy}>Wallet der Sicherungen speichern</button>
		<p>Schlüssel für die Wiederherstellung (age):</p>
		<p data-testid="age-status">{profile.ageIdentity ? 'hinterlegt (versiegelt)' : 'nicht hinterlegt'}</p>
		<textarea bind:value={ageInput} rows="2" autocomplete="off" spellcheck="false" placeholder="AGE-SECRET-KEY-1…"></textarea>
		<button onclick={saveAge} disabled={busy || !ageInput.trim()}>Versiegelt hinterlegen</button>

		<h3>6. Paperless-Image und Knoten</h3>
		<input bind:value={imageInput} placeholder="Image (STORE-Hash)" />
		<input bind:value={crnInput} placeholder="SEV-SNP-Knoten (Hash)" />
		<input bind:value={passInput} type="password" autocomplete="off" placeholder={profile.luksPassphrase ? 'Passphrase hinterlegt (leer lassen = behalten)' : 'Passphrase des Images'} />
		<button onclick={saveImage} disabled={busy}>Image und Knoten speichern</button>
	{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.setup { margin-top: 2rem; border-top: 1px solid #ddd; }
	h3 { margin-top: 1.5rem; font-size: 1rem; }
	select, input, textarea { width: 100%; font-size: 1rem; }
	button { display: block; margin: 0.5rem 0; padding: 0.5rem 1rem; font-size: 1rem; }
	code { word-break: break-all; }
	.error { color: #b00020; }
</style>
