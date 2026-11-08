<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey, fixedHostLabel } from '$lib/keys/derive.js';
	import { FIXED_HOST_DOMAIN } from '$lib/vm.js';
	import { backupPayer, loadProfile, updateProfile } from '$lib/profile.js';
	import { ageIdentityFromMaster, ageRecipient } from '$lib/keys/age.js';
	import { BACKUP_LABEL, backupConfigFor } from '$lib/backups.js';
	import { relayList } from '$lib/attest-p2p.js';
	import { findAttestRelays } from '$lib/relays.js';
	import { CREDITS_URL, creditsCatalog, fundBackups } from '$lib/credits.js';
	import { formatEther, formatUnits } from 'viem';
	import BackupPlaces from '$lib/BackupPlaces.svelte';
	import {
		connectPayer,
		creditsPayerAccount,
		creditsPayerState,
		isAuthorized,
		prepareCreditsPayer,
		waitForPayerFil,
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
	const creditsPayer = creditsPayerAccount(master).address;
	/** @type {Awaited<ReturnType<typeof creditsPayerState>> | null} */
	let payerState = $state(null);

	/** @type {Record<string, any>} */
	let profile = $state({});
	let loaded = $state(false);
	let alephOk = $state(false);
	let sessionUntil = $state(0n);
	let relayInput = $state('');
	/** @type {string[] | null} Le Space's attest relays as Aleph knows them now. */
	let foundRelays = $state(null);
	findAttestRelays().then((list) => (foundRelays = list));
	let ageInput = $state('');
	let imageInput = $state('');
	let ownerInput = $state('');
	let passInput = $state('');
	let crnInput = $state('');
	let dnsInput = $state('');
	let error = $state('');
	// Which action is running: only that one is blocked. Wallet actions share
	// 'wallet', since MetaMask answers one request at a time.
	let busy = $state('');

	async function refresh() {
		if (profile.backupsByCredits) {
			payerState = await creditsPayerState(master, profile.network ?? 'calibration').catch(() => null);
			sessionUntil = payerState?.sessionUntil ?? 0n;
		}
		if (profile.payer && !profile.backupsByCredits) {
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

	// Which action the message belongs to: it shows beside that action, and a
	// short "gespeichert" confirms one that went through.
	let errorKey = $state('');
	let savedKey = $state('');
	let savedTimer = 0;
	async function run(key, fn) {
		error = '';
		errorKey = key;
		savedKey = '';
		busy = key;
		try {
			await fn();
			savedKey = key;
			clearTimeout(savedTimer);
			savedTimer = setTimeout(() => (savedKey = ''), 4000);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = '';
		}
	}
	const save = async (patch) => {
		profile = { network: 'calibration', ...(await updateProfile(master, (now) => ({ ...now, ...$state.snapshot(patch) }))) };
		onsaved();
	};

	const connect = () => run('wallet', async () => {
		await save({ payer: await connectPayer() });
		await refresh();
	});
	// Providers and data sets differ per network: switching drops the backup
	// places, which are then chosen again for the new network.
	const changeNetwork = (network) => run('network', async () => {
		await save({ network, ...(profile.backupConfig ? { backupConfig: null } : {}) });
		await refresh();
	});
	// Who pays the VM: the wallet, the app's own address, or Le Space for this
	// customer from the package (model A, le-space-credits#38).
	const setPays = (/** @type {'wallet' | 'app' | 'lespace'} */ who) => run('pays', () => save({ appPays: who === 'app', leSpacePays: who === 'lespace' }));
	const setAppPays = (on) => setPays(on ? 'app' : 'wallet');
	// One instance reads the mailbox and writes the mainnet backups; switching
	// another one to that role while the first still runs would duplicate both.
	/** @param {'test' | 'primary'} role @param {HTMLInputElement} [radio] */
	const setRole = (role, radio) => run('role', async () => {
		if (role === 'primary' && !confirm('Diese Paperless produktiv machen? Sie ruft dann die Mails ab und schreibt die Mainnet-Sicherungen. Nur eine Instanz darf das: eine andere (z. B. auf dem Mac) vorher anhalten.')) {
			// The browser already moved the selection; put it back.
			const test = radio?.closest('fieldset')?.querySelector('input[value="test"]');
			if (test instanceof HTMLInputElement) test.checked = true;
			return;
		}
		await save({ role: role === 'primary' ? 'primary' : 'test' });
	});
	const authorize = (revoke = false) => run('wallet', async () => {
		await setAlephAuthorization(profile.payer, pwaAddress, { revoke });
		alephOk = !revoke;
	});
	const session = (revoke = false) => run('wallet', async () => {
		await setFilecoinSessionKey(profile.payer, sessionAddress, profile.network, { days: 30, revoke });
		await refresh();
	});
	// Backups paid through Le Space Credits: the vault's own Filecoin payer,
	// funded by the service; it sends its approval and session key itself.
	const setBackupsByCredits = (on) => run('bycredits', async () => {
		await save({ backupsByCredits: on });
		await refresh();
	});
	const payBackups = () => run('bycredits', async () => {
		const want = profile.network === 'mainnet' ? 'mainnet' : 'calibration';
		// Asked before paying: credits spent in the wrong network would be lost to this Paperless.
		const offered = (await creditsCatalog().catch(() => null))?.network;
		if (offered === null) throw new Error('Le Space Credits bezahlen gerade keine Sicherungen.');
		if (offered && offered !== want) throw new Error(`Le Space Credits bezahlen Sicherungen gerade im ${offered === 'mainnet' ? 'Produktivnetz' : 'Testnetz'}; diese Paperless sichert im ${want === 'mainnet' ? 'Produktivnetz' : 'Testnetz'}. Nichts abgebucht.`);
		const r = await fundBackups(master, creditsPayer, 1);
		if (r.network && r.network !== want) throw new Error(`Le Space Credits zahlen gerade im Netz ${r.network}, diese Paperless sichert in ${want}.`);
		if (!r.confirmed) {
			await refresh();
			throw new Error('Bezahlt; die Einzahlung ist noch unterwegs. In ein paar Minuten „Freigaben senden“.');
		}
		// The FIL for the approval may follow the deposit: wait for it first.
		if (r.filSent !== '0' && !(await waitForPayerFil(master, want))) {
			await refresh();
			throw new Error('Bezahlt; das Filecoin für die Gebühren ist noch unterwegs. In ein paar Minuten „Freigaben senden“.');
		}
		await prepareCreditsPayer(master, want);
		await refresh();
	});
	const preparePayer = () => run('bycredits', async () => {
		await prepareCreditsPayer(master, profile.network === 'mainnet' ? 'mainnet' : 'calibration');
		await refresh();
	});
	const saveRelay = () => run('relay', async () => {
		// wss://<host>/attest, ws:// only to this machine (a relay beside a test),
		// or an orbitdb-relay's multiaddr; several are tried in turn.
		// Empty: only Le Space's relays, found on Aleph at every start.
		const relays = relayList(relayInput);
		await save({ attestRelay: relays.length ? relays.join('\n') : null });
		relayInput = relays.join('\n');
	});
	const saveAge = () => run('age', async () => {
		const line = ageInput.split('\n').map((l) => l.trim()).find((l) => l.startsWith('AGE-SECRET-KEY-'));
		if (!line || !/^AGE-SECRET-KEY-1[0-9A-Z]{58}$/.test(line)) throw new Error('Kein gültiger age-Schlüssel (AGE-SECRET-KEY-1…).');
		await save({ ageIdentity: line, ...(profile.backupConfig ? { backupConfig: backupConfigFor(profile.network, ageRecipient(line), profile.backupConfig) } : {}) });
		ageInput = '';
	});
	// The vault's own key, derived from the master secret: the 24 words alone
	// decrypt every backup made with it. Only its recipient is ever shown.
	const vaultAge = $derived(ageIdentityFromMaster(master));
	const useVaultAge = () => run('age', async () => {
		if (profile.ageIdentity && profile.ageIdentity !== vaultAge && !confirm('Den eingefügten Schlüssel durch den des Tresors ersetzen? Sicherungen, die mit dem alten verschlüsselt sind, brauchen dann weiterhin den alten.')) return;
		await save({ ageIdentity: vaultAge, ...(profile.backupConfig ? { backupConfig: backupConfigFor(profile.network, ageRecipient(vaultAge), profile.backupConfig) } : {}) });
	});
	// Without a key yet, backups use the vault's own: the default.
	const toggleBackups = (on) => run('backups', async () => {
		const identity = profile.ageIdentity || vaultAge;
		await save(on ? { ageIdentity: identity, backupConfig: backupConfigFor(profile.network, ageRecipient(identity)) } : { backupConfig: null });
	});
	const savePlaces = (places) => run('places', async () => {
		await save({ backupConfig: backupConfigFor(profile.network, ageRecipient(profile.ageIdentity || vaultAge), places) });
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
	const saveDns = () => run('dns', async () => {
		const token = dnsInput.trim();
		// Cloudflare API tokens are 40 characters of [A-Za-z0-9_-].
		if (token && !/^[A-Za-z0-9_-]{30,80}$/.test(token)) throw new Error('Ein Cloudflare-API-Token (etwa 40 Zeichen).');
		await save({ dnsToken: token || null });
		dnsInput = '';
	});
	const until = (s) => (s > 0n && Number(s) * 1000 > Date.now() ? new Date(Number(s) * 1000).toLocaleDateString('de-DE') : '');
</script>

<section class="setup" data-testid="setup">
	<h2>Einrichtung</h2>
	<details class="where" data-testid="setup-where">
		<summary>Wo die Einrichtung liegt: verschlüsselt auf Aleph, auf jedem Gerät da</summary>
		<p>Jede Änderung hier wird <strong>in diesem Browser verschlüsselt</strong> (AES-256-GCM, mit einem Schlüssel aus deinem Tresor) und dann <strong>auf Aleph</strong> gespeichert, unter dem Schlüssel dieser App. Jedes Gerät, das den Tresor öffnet (Passkey oder 24 Wörter), findet dieselbe Einrichtung.</p>
		<p>Drin sind: zahlendes Konto, Netz, Relays, Image, Knoten und Passphrase des Images, die Sicherungseinstellungen samt Schlüssel der Sicherungen (age) und die laufende VM.</p>
		<p>Aleph sieht nur einen verschlüsselten Block, wann er sich ändert, und (im Wallet des zahlenden Kontos) dass es diese App freigegeben hat, nicht den Inhalt.
			Mehr: <a href="https://github.com/Le-Space/paperless-anywhere/blob/main/docs/keys-and-recovery.md#where-the-setup-is-kept" target="_blank" rel="noopener">Schlüssel und Wiederherstellung</a>.</p>
	</details>
	{#if busy === 'wallet'}<p class="waiting" data-testid="wallet-waiting">Warte auf MetaMask … (bitte dort bestätigen oder ablehnen)</p>{/if}
	{#if !loaded}
		<p>Lade Einstellungen …</p>
	{:else}
		<label>
			Netz
			<select value={profile.network} onchange={(e) => changeNetwork(e.currentTarget.value)} disabled={busy === 'wallet'}>
				<option value="calibration">Test (Calibration)</option>
				<option value="mainnet">Produktiv (Mainnet)</option>
			</select>
		</label>

		<fieldset class="role" disabled={busy === 'role'} data-testid="role">
			<legend>Rolle dieser Paperless</legend>
			<label><input type="radio" name="role" value="test" checked={profile.role !== 'primary'} onchange={() => setRole('test')} data-testid="role-test" /> Test: Mail-Regeln aus, Sicherungen ins Testnetz</label>
			<label><input type="radio" name="role" value="primary" checked={profile.role === 'primary'} onchange={(e) => setRole('primary', e.currentTarget)} data-testid="role-primary" /> Produktiv: ruft die Mails ab und sichert auf Mainnet</label>
			{#if profile.role === 'primary'}
				<p class="warn" data-testid="role-warning">Nur eine Instanz darf produktiv sein. Läuft Paperless noch anderswo produktiv (z. B. auf dem Mac), dort zuerst die Mail-Regeln und die tägliche Sicherung ausschalten.{#if profile.network !== 'mainnet'} Produktiv braucht das Netz „Produktiv (Mainnet)“.{/if}</p>
			{/if}
		</fieldset>
		{@render feedback('network')}{@render feedback('role')}

		<h3>1. Wer zahlt die VM?</h3>
		<fieldset class="payer-choice" disabled={busy === 'pays'}>
			{#if CREDITS_URL}<label><input type="radio" name="pays" checked={Boolean(profile.leSpacePays)} onchange={() => setPays('lespace')} data-testid="pays-lespace" /> Le Space, aus meinem Paket: kein Wallet, keine Kryptowerte</label>{/if}
			<label><input type="radio" name="pays" checked={!profile.appPays && !profile.leSpacePays} onchange={() => setPays('wallet')} data-testid="pays-wallet" /> Mein Wallet (MetaMask), mit einer Freigabe für diese App</label>
			<label><input type="radio" name="pays" checked={Boolean(profile.appPays) && !profile.leSpacePays} onchange={() => setPays('app')} data-testid="pays-app" /> Diese App selbst: Aleph-Credits liegen auf ihrer Adresse</label>
		</fieldset>
		{#if profile.leSpacePays}
			<p class="hint" data-testid="lespace-pays">Le Space bezahlt deine VM aus einem eigenen Konto für dich; diese App startet und beendet sie in dessen Auftrag. Abgerechnet wird über dein Paket. {profile.vmOwner ? 'Konto für deine VM: ' : ''}{#if profile.vmOwner}<code>{profile.vmOwner}</code>{/if}</p>
		{:else if profile.appPays}
			<p>Adresse der App: <code data-testid="app-payer">{pwaAddress}</code>
				<br /><small class="money">Hier liegen die Aleph-Credits für die VMs. Der Schlüssel dazu kommt aus deinem Tresor: wer den Tresor öffnet, kann sie ausgeben. Aufladen per Aleph-Überweisung an diese Adresse{CREDITS_URL ? ' oder aus Le Space Credits' : ''}.</small></p>
			<p class="hint">Ein Wallet brauchst du so nur für Sicherungen (Filecoin){CREDITS_URL ? ', und auch dafür nicht, wenn Le Space Credits sie bezahlen (Schritt 5)' : ''}.</p>
		{/if}
		{#if profile.payer}
			<p>{profile.appPays ? 'Wallet für die Sicherungen' : 'Verbunden'}: <code data-testid="payer">{profile.payer}</code>
				<br /><small class="money">{profile.appPays ? 'Hier liegt das Geld für die Sicherungen: im Testnetz tFIL und USDFC.' : 'Hier liegt das Geld: Aleph-Credits für die VMs, im Testnetz tFIL und USDFC für die Sicherungen.'} Der Schlüssel dazu bleibt in deinem Wallet; diese App sieht ihn nie.</small></p>
		{/if}
		{@render feedback('pays')}
		<button onclick={connect} disabled={busy === 'wallet'}>{profile.payer ? 'Anderes Wallet verbinden' : profile.appPays ? 'Wallet für Sicherungen verbinden' : 'Wallet verbinden'}</button>

		{#if profile.payer && !profile.appPays && !profile.leSpacePays}
			<h3>2. Aleph: diese App darf VMs starten und löschen</h3>
			<p>App-Schlüssel: <code>{pwaAddress}</code>
				<br /><small class="nomoney">Hält kein Geld – nichts dorthin überweisen. Er darf nur im Auftrag des zahlenden Kontos VMs starten und löschen.</small></p>
			<p data-testid="aleph-status">{alephOk ? 'freigegeben (INSTANCE, FORGET, Port-Freigaben)' : 'nicht freigegeben'}</p>
			{#if alephOk}
				<button onclick={() => authorize(true)} disabled={busy === 'wallet'}>Freigabe zurücknehmen</button>
			{:else}
				<button onclick={() => authorize()} disabled={busy === 'wallet'}>Im Wallet freigeben</button>
			{/if}
		{/if}

		{#if profile.payer && !profile.backupsByCredits}

			<h3>3. Filecoin: Sicherungen hinzufügen</h3>
			<p>Sitzungsschlüssel: <code>{sessionAddress}</code>
				<br /><small class="nomoney">Hält kein Geld – nichts dorthin überweisen. Er darf 30 Tage lang Sicherungen hinzufügen, bezahlt vom zahlenden Konto.</small></p>
			<p data-testid="session-status">{until(sessionUntil) ? `gültig bis ${until(sessionUntil)}` : 'nicht freigegeben'}</p>
			{@render feedback('wallet')}
			<button onclick={() => session()} disabled={busy === 'wallet'}>{until(sessionUntil) ? 'Um 30 Tage verlängern' : 'Für 30 Tage freigeben'}</button>
			{#if until(sessionUntil)}<button onclick={() => session(true)} disabled={busy === 'wallet'}>Zurücknehmen</button>{/if}
		{/if}

		<h3>4. Attest-Relay</h3>
		<p class="hint">Die App findet die Relays von Le Space bei jedem Start selbst über Aleph: nur solche, die Aleph als laufende VM eines Le-Space-Kontos führt. Ein Relay sieht die Prüfung der VM nur verschlüsselt.</p>
		<p data-testid="relays-found">Gefunden: {#if foundRelays === null}…{:else if foundRelays.length}{#each foundRelays as relay, i (relay)}{i ? ', ' : ''}<code>{relay}</code>{/each}{:else}keins (Aleph gerade nicht erreichbar oder kein Relay angemeldet){/if}</p>
		<label>Eigene Relays (optional), eins pro Zeile, werden vor denen von Le Space versucht: <code>wss://…/attest</code> oder die Multiaddr eines orbitdb-relay (<code>/dns4/…/p2p/…</code>)
			<textarea bind:value={relayInput} rows="3" autocomplete="off" spellcheck="false" placeholder="leer = nur die Relays von Le Space" data-testid="relays"></textarea></label>
		<button onclick={saveRelay} disabled={busy === 'relay'}>{relayInput.trim() || !profile.attestRelay ? 'Relays speichern' : 'Eigene Relays entfernen'}</button>
		{@render feedback('relay')}

		<h3>5. Sicherungen</h3>
		{#if CREDITS_URL}
			<fieldset class="payer-choice" disabled={busy === 'bycredits'} data-testid="backups-paid-by">
				<label><input type="radio" name="bypay" checked={!profile.backupsByCredits} onchange={() => setBackupsByCredits(false)} data-testid="backups-wallet" /> Bezahlt aus meinem Wallet (Schritt 3)</label>
				<label><input type="radio" name="bypay" checked={Boolean(profile.backupsByCredits)} onchange={() => setBackupsByCredits(true)} data-testid="backups-credits" /> Bezahlt über Le Space Credits, ohne Wallet</label>
			</fieldset>
			{#if profile.backupsByCredits}
				<p>Sicherungskonto: <code data-testid="credits-payer">{creditsPayer}</code>
					<br /><small class="money">Aus deinem Tresor abgeleitet. Le Space Credits zahlen hier das Guthaben für den Speicher ein; nichts selbst überweisen.</small></p>
				<p data-testid="credits-payer-state">{#if !payerState}…{:else}Guthaben für den Speicher: {formatUnits(payerState.deposit, 18)} USDFC · Gebühren: {formatEther(payerState.fil)} FIL · Speicherdienst {payerState.approved ? 'freigegeben' : 'noch nicht freigegeben'} · Sitzungsschlüssel {until(sessionUntil) ? `gültig bis ${until(sessionUntil)}` : 'nicht freigegeben'}{/if}</p>
				<button onclick={payBackups} disabled={busy === 'bycredits'} data-testid="pay-backups">Einen Monat Sicherungen bezahlen</button>
				{#if payerState && payerState.fil > 0n && (!payerState.approved || !until(sessionUntil))}<button onclick={preparePayer} disabled={busy === 'bycredits'} data-testid="prepare-payer">Freigaben senden</button>{/if}
				{@render feedback('bycredits')}
			{/if}
		{/if}
		<label>Wallet, dem die Sicherungen gehören (0x…, leer = zahlendes Konto)<input bind:value={ownerInput} placeholder={profile.payer ? `Wallet der Sicherungen (leer = ${profile.payer.slice(0, 10)}…)` : 'Wallet der Sicherungen'} /></label>
		<button onclick={saveOwner} disabled={busy === 'owner'}>Wallet der Sicherungen speichern</button>
		{@render feedback('owner')}
		<p>Schlüssel der Sicherungen (age): die VM verschlüsselt jede Sicherung für ihn, eine Wiederherstellung braucht ihn.</p>
		<p data-testid="age-status">{!profile.ageIdentity ? 'nicht hinterlegt' : profile.ageIdentity === vaultAge ? 'der Schlüssel des Tresors (die 24 Wörter genügen zur Wiederherstellung)' : 'eingefügt (nicht aus dem Tresor: getrennt aufbewahren!)'}</p>
		{#if recipient}<p><small>Empfänger: <code data-testid="age-recipient">{recipient}</code></small></p>{/if}
		{#if profile.ageIdentity !== vaultAge}<button onclick={useVaultAge} disabled={busy === 'age'}>Schlüssel des Tresors verwenden (empfohlen)</button>{/if}
		<details>
			<summary>Einen vorhandenen Schlüssel einfügen</summary>
			<textarea bind:value={ageInput} rows="2" autocomplete="off" spellcheck="false" placeholder="AGE-SECRET-KEY-1…"></textarea>
			<button onclick={saveAge} disabled={busy === 'age' || !ageInput.trim()}>Versiegelt hinterlegen</button>
		</details>
		{@render feedback('age')}
		<label class="check">
			<input type="checkbox" data-testid="backups-on" checked={!!profile.backupConfig} disabled={busy === 'backups' || (!profile.backupConfig && profile.network === 'mainnet' && profile.role !== 'primary')}
				onchange={(e) => toggleBackups(e.currentTarget.checked)} />
			Sichern, alle zwei Stunden bei Änderungen und beim Stoppen ({profile.network === 'mainnet' ? 'Mainnet' : 'Testnetz'}, Datensatz <code>{BACKUP_LABEL[profile.network === 'mainnet' ? 'mainnet' : 'calibration']}</code>)
		</label>
		{#if profile.backupConfig}
			<BackupPlaces network={profile.network} payer={profile.backupOwner || backupPayer(profile, creditsPayer)} config={profile.backupConfig} busy={busy === 'places'} onsave={savePlaces} />
		{/if}
		{@render feedback('backups')}{@render feedback('places')}
		{#if profile.network === 'mainnet' && profile.role !== 'primary'}<p class="hint" data-testid="mainnet-backup-hint">Auf Mainnet sichert nur eine produktive Paperless (Rolle oben). Als Test bleibt sie ohne Sicherung.</p>
		{:else if profile.backupConfig && !until(sessionUntil)}<p class="hint">{profile.backupsByCredits ? 'Dafür braucht die VM den Sitzungsschlüssel: Sicherungen bezahlen, dann setzt die App ihn selbst.' : 'Dafür braucht die VM den Sitzungsschlüssel aus Schritt 3.'}</p>{/if}

		<h3>6. Paperless-Image und Knoten</h3>
		<label>Image (STORE-Hash, 64 Zeichen)<input bind:value={imageInput} placeholder="Image (STORE-Hash)" /></label>
		<label>SEV-SNP-Knoten (Hash, 64 Zeichen)<input bind:value={crnInput} placeholder="SEV-SNP-Knoten (Hash)" /></label>
		<label>Passphrase des Images<input bind:value={passInput} type="password" autocomplete="off" placeholder={profile.luksPassphrase ? `Passphrase hinterlegt, ${profile.luksPassphrase.length} Zeichen (leer lassen = behalten)` : 'Passphrase des Images'} /></label>
		<button onclick={saveImage} disabled={busy === 'image'}>Image und Knoten speichern</button>
		{@render feedback('image')}

		<h3>7. Feste Adresse (optional)</h3>
		<p class="hint">Mit einem Cloudflare-API-Token (Zone {FIXED_HOST_DOMAIN.split('.').slice(-2).join('.')}, Rechte: DNS bearbeiten, Zone lesen) bekommt Paperless bei jedem Start dieselbe Adresse, <code>{fixedHostLabel(master)}.{FIXED_HOST_DOMAIN}</code>: Die VM trägt sich selbst ein und holt das Zertifikat über DNS. Ohne Token gibt es bei jedem Start einen neuen <code>*.2n6.me</code>-Namen. Das Token kann alle DNS-Einträge der Zone ändern; es liegt verschlüsselt im Profil und geht nur an die VM.</p>
		<label>Cloudflare-API-Token<input bind:value={dnsInput} type="password" autocomplete="off" data-testid="dns-token" placeholder={profile.dnsToken ? 'Token hinterlegt (leer speichern = entfernen)' : 'Cloudflare-API-Token'} /></label>
		<button onclick={saveDns} disabled={busy === 'dns'}>{profile.dnsToken && !dnsInput.trim() ? 'Token entfernen' : 'Token speichern'}</button>
		{@render feedback('dns')}
	{/if}
	{#if error && !errorKey}<p class="error" role="alert">{error}</p>{/if}
</section>

{#snippet feedback(/** @type {string} */ key)}
	{#if error && errorKey === key}<p class="error" role="alert" data-testid={`error-${key}`}>{error}</p>
	{:else if savedKey === key}<p class="saved" data-testid={`saved-${key}`}>Gespeichert ✓</p>{/if}
{/snippet}

<style>
	.setup { margin: 0 0 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.25rem; }
	h3 { margin-top: 1.5rem; font-size: 1rem; }
	select, input, textarea { width: 100%; font-size: 1rem; }
	button { display: block; margin: 0.5rem 0; padding: 0.5rem 1rem; font-size: 1rem; }
	code { word-break: break-all; }
	label.check { display: flex; gap: 0.5rem; align-items: baseline; color: var(--text); font-size: 1rem; }
	label.check input { width: auto; }
	.money { color: var(--ok); }
	.nomoney { color: var(--warn); }
	.hint { color: var(--text-2); font-size: 0.9rem; }
	label { display: block; margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-2); }
	.role { border: 1px solid var(--line); border-radius: 4px; padding: 0.4rem 0.75rem; margin: 0.5rem 0 1rem; display: grid; gap: 0.25rem; }
	.role input { width: auto; margin-right: 0.4rem; }
	.role .warn { color: var(--warn); margin: 0.25rem 0 0; font-size: 0.9rem; }
	.saved { color: var(--ok); font-size: 0.9rem; margin: 0.25rem 0; }
	.payer-choice { border: none; padding: 0; margin: 0 0 0.5rem; display: grid; gap: 0.25rem; }
	/* The page sizes inputs to full width; a radio keeps its own size beside its label. */
	.payer-choice input { width: auto; margin-right: 0.4rem; }
	.where { margin: 0.5rem 0 1rem; font-size: 0.9rem; color: var(--text-2); }
	.where summary { cursor: pointer; }
	.waiting { background: var(--warn-bg); padding: 0.5rem 0.75rem; border-radius: 4px; }
	.error { color: var(--danger); }
</style>
