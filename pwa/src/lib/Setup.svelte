<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey, fixedHostLabel } from '$lib/keys/derive.js';
	import { FIXED_HOST_DOMAIN } from '$lib/vm.js';
	import { loadProfile, updateProfile } from '$lib/profile.js';
	import { ageIdentityFromMaster, ageRecipient } from '$lib/keys/age.js';
	import { BACKUP_LABEL, backupConfigFor } from '$lib/backups.js';
	import { relayList } from '$lib/attest-p2p.js';
	import { findAttestRelays } from '$lib/relays.js';
	import { backupAuthorize, backupKeyAddress, CREDITS_URL, creditsBalance, creditsCatalog, fundBackups, IMAGE_BUILD_TYPES, imageBuild, imageBuildDone, vmAuthorize } from '$lib/credits.js';
	import BackupPlaces from '$lib/BackupPlaces.svelte';
	import { BUILDER, buildAffordable, buildOnOwnBuilder, buildPaidByPackage, buildOwnImage, builderOpener, forgetLeftBuilder, hasOwnImage, imageFields, imageKindOf, sources } from '$lib/own-image.js';
	import { format, lang, t, tr } from '$lib/i18n/index.js';
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
	const x = $derived($t.setup);

	const pwaAddress = privateKeyToAccount(alephPrivateKey(master)).address;
	const sessionAddress = sessionKeyAddress(master);
	// The VM's backup key when Le Space Credits pay the backups: the service
	// signs each backup step for it. Only its address is ever shown.
	const backupKey = backupKeyAddress(master);
	/** @type {{ payer: string, signer: string | null, tag: string, network: string, fundedUntil: string | null, dataSets: string[] } | null | undefined} undefined while it loads */
	let backupState = $state(undefined);

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
			backupState = undefined;
			backupState = (await creditsBalance(master).catch(() => null))?.backup ?? null;
			// The service may have a new payer or signer since the key was authorized.
			const s = profile.backupSigner;
			if (s && backupState && backupState.network === s.network && backupState.signer && (backupState.payer !== s.payer || backupState.signer !== s.signer || backupState.tag !== s.tag)) {
				await save({ backupSigner: { ...s, payer: backupState.payer, signer: backupState.signer, tag: backupState.tag } });
			}
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
				imageKind = imageKindOf(profile, BUILDER);
				loaded = true;
				// A build's builder that a closed window left running: forget it now.
				if (profile.ownBuilder) {
					const left = profile.ownBuilder;
					forgetLeftBuilder(privateKeyToAccount(alephPrivateKey(master)), profile)
						.then(async (gone) => {
							if (!gone) return;
							// Paid by the package: the service takes back the rest of its grant.
							if (left.buildId) await imageBuildDone(master, { buildId: left.buildId, program: left.vprogram }).catch(() => {});
							await save({ ownBuilder: null });
						})
						.catch(() => {});
				}
				await refresh();
			})
			.catch((e) => (error = e.message));
	});

	// Which action the message belongs to: it shows beside that action, and a
	// short "saved" confirms one that went through.
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
		// The service's answer for the backup key is per network too.
		await save({ network, ...(profile.backupConfig ? { backupConfig: null } : {}), ...(profile.backupSigner ? { backupSigner: null } : {}) });
		await refresh();
	});
	// Who pays the VM: the wallet, the app's own address, or Le Space for this
	// customer from the package (model A, le-space-credits#38).
	// Without a wallet the backups go through Le Space Credits by default, as
	// long as nobody chose otherwise (#105); an explicit choice is never changed.
	const setPays = (/** @type {'wallet' | 'app' | 'lespace'} */ who) => run('pays', async () => {
		const byCredits = CREDITS_URL && who !== 'wallet' && !profile.payer && profile.backupsByCredits === undefined;
		await save({ appPays: who === 'app', leSpacePays: who === 'lespace', ...(byCredits ? { backupsByCredits: true } : {}) });
		if (byCredits) await refresh();
	});
	const setAppPays = (on) => setPays(on ? 'app' : 'wallet');
	// One instance reads the mailbox and writes the mainnet backups; switching
	// another one to that role while the first still runs would duplicate both.
	/** @param {'test' | 'primary'} role @param {HTMLInputElement} [radio] */
	const setRole = (role, radio) => run('role', async () => {
		if (role === 'primary' && !confirm(tr().setup.role.confirm)) {
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
	// Backups paid through Le Space Credits: Le Space's one payer pays the
	// storage, and the service signs each backup step for the VM's backup key
	// (design 2.2). Nothing moves on chain from here.
	const setBackupsByCredits = (on) => run('bycredits', async () => {
		await save({ backupsByCredits: on });
		await refresh();
	});
	const wantNetwork = () => (profile.network === 'mainnet' ? 'mainnet' : 'calibration');
	const netName = (/** @type {string} */ network) => tr().setup.backups.netName[network === 'mainnet' ? 'mainnet' : 'calibration'];
	/** Give the service the VM's backup key, and record what the VM's config needs. */
	async function authorizeKey() {
		const want = wantNetwork();
		const s = await backupAuthorize(master, backupKey);
		if (s.network !== want) throw new Error(tr().setup.backups.errors.otherNetwork(netName(s.network), netName(want)));
		await save({ backupSigner: { payer: s.payer, signer: s.signer, tag: s.tag, label: s.label, network: s.network } });
	}
	const payBackups = () => run('bycredits', async () => {
		const want = wantNetwork();
		// Asked before paying: credits spent in the wrong network would be lost to this Paperless.
		const offered = (await creditsCatalog().catch(() => null))?.network;
		if (offered === null) throw new Error(tr().setup.backups.notPaying);
		if (offered && offered !== want) throw new Error(tr().setup.backups.errors.payOtherNetwork(netName(offered), netName(want)));
		const r = await fundBackups(master, 1);
		if (r.network && r.network !== want) throw new Error(tr().setup.backups.errors.fundNetwork(r.network, want));
		await authorizeKey();
		await refresh();
	});
	const authorizeBackupKey = () => run('bycredits', async () => {
		await authorizeKey();
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
		if (!line || !/^AGE-SECRET-KEY-1[0-9A-Z]{58}$/.test(line)) throw new Error(tr().setup.backups.errors.badAge);
		await save({ ageIdentity: line, ...(profile.backupConfig ? { backupConfig: backupConfigFor(profile.network, ageRecipient(line), profile.backupConfig) } : {}) });
		ageInput = '';
	});
	// The vault's own key, derived from the master secret: the 24 words alone
	// decrypt every backup made with it. Only its recipient is ever shown.
	const vaultAge = $derived(ageIdentityFromMaster(master));
	const useVaultAge = () => run('age', async () => {
		if (profile.ageIdentity && profile.ageIdentity !== vaultAge && !confirm(tr().setup.backups.errors.replaceAge)) return;
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
		if (owner && !/^0x[0-9a-fA-F]{40}$/.test(owner)) throw new Error(tr().setup.backups.errors.badOwner);
		await save({ backupOwner: owner || null });
	});
	const saveImage = () => run('image', async () => {
		await save(imageFields({ kind: publicImage ? 'public' : 'own', image: imageInput, crn: crnInput, pass: passInput, profile }));
		passInput = '';
	});
	// "Mein Image bauen": this vault's own copy of the public image, sealed by
	// the attested builder with a passphrase derived from the master secret
	// (own-image.js). Shown only when a builder is fixed in the app.
	let ownStep = $state('');
	// Which image: the public one, whose passphrase Le Space and everyone using
	// that version know, or this vault's own. Shown only when a builder is fixed.
	/** @type {'public' | 'own'} */
	let imageKind = $state('public');
	const publicImage = $derived(!BUILDER || imageKind === 'public');
	// Whether the app address can pay a build now (a day of the builder, the
	// image's storage and what it already pays): the build is offered only
	// then. Unknown (Aleph not asked) offers it, and Aleph's answer decides.
	// With a Le Space package the package pays (Le Space Credits): its price
	// for one build, or why it cannot (no package, too little balance).
	/** @type {{ ok: boolean | null, need?: number | null, have?: number | null, price?: number | null, reason?: string } | null} */
	let affordable = $state(null);
	const packagePays = $derived(Boolean(profile?.leSpacePays && CREDITS_URL));
	$effect(() => {
		if (!BUILDER || imageKind !== 'own' || !loaded || affordable) return;
		if (packagePays)
			imageBuild(master, { quote: true })
				.then((q) => (affordable = { ok: true, price: q.chargedCredits }))
				.catch((e) => (affordable = { ok: false, reason: e.message }));
		else buildAffordable(privateKeyToAccount(alephPrivateKey(master)), /** @type {any} */ (BUILDER)).then((a) => (affordable = a));
	});
	const ownBuilt = $derived(Boolean(BUILDER && hasOwnImage(profile, BUILDER.plain.sha256)));
	// Back to the public image after an own one: its hash and passphrase are
	// entered anew, not the own image's kept under the other name.
	const choosePublic = () => {
		if (ownBuilt) imageInput = '';
		passInput = '';
	};
	const buildImage = () => run('own-image', async () => {
		if (!BUILDER) return;
		ownStep = '';
		try {
			const common = { master, app: privateKeyToAccount(alephPrivateKey(master)), onProgress: (/** @type {{ detail?: string }} */ { detail }) => (ownStep = detail ?? '') };
			// A builder fixed by its V-PROGRAM content is started for this build
			// and forgotten afterwards; the profile notes it meanwhile.
			const onForgotten = () => save({ ownBuilder: null });
			const opener = (/** @type {any} */ running) => builderOpener(running, profile);
			let built;
			if ('program' in BUILDER && packagePays) {
				// The package pays: the app key may send the builder and the STORE
				// for the sub-account (authorize again picks up new types), and the
				// person sees the price and agrees first.
				const granted = await vmAuthorize(master);
				if (!granted.types || !IMAGE_BUILD_TYPES.every((type) => granted.types?.includes(type))) throw new Error($t.ownImage.choice.serviceOld);
				const quote = await imageBuild(master, { quote: true });
				if (!confirm($t.ownImage.choice.confirmPrice(format.euro(quote.chargedCredits ?? 0, $lang)))) return;
				built = await buildPaidByPackage({
					...common,
					builder: /** @type {any} */ (BUILDER),
					opener,
					charge: () => imageBuild(master),
					done: (d) => imageBuildDone(master, d),
					onStarted: (vprogram, paid) => save({ ownBuilder: { vprogram, payer: paid?.payer ?? null, buildId: paid?.buildId ?? null, at: new Date().toISOString() } }),
					onForgotten
				});
			} else built = 'program' in BUILDER
				? await buildOnOwnBuilder({
						...common,
						builder: /** @type {any} */ (BUILDER),
						opener: (running) => builderOpener(running, profile),
						onStarted: (vprogram) => save({ ownBuilder: { vprogram, at: new Date().toISOString() } }),
						onForgotten
					})
				: await buildOwnImage({ ...common, builder: BUILDER, open: builderOpener(BUILDER, profile) });
			await save(built);
			imageInput = built.rootfsItemHash;
			passInput = '';
		} finally {
			ownStep = '';
		}
	});
	const saveDns = () => run('dns', async () => {
		const token = dnsInput.trim();
		// Cloudflare API tokens are 40 characters of [A-Za-z0-9_-].
		if (token && !/^[A-Za-z0-9_-]{30,80}$/.test(token)) throw new Error(tr().setup.address.badToken);
		await save({ dnsToken: token || null });
		dnsInput = '';
	});
	// Steps are numbered as shown: when the app or Le Space pays, there is no
	// Aleph approval; when credits pay the backups, no Filecoin session key.
	const showAleph = $derived(Boolean(profile?.payer && !profile.appPays && !profile.leSpacePays));
	const showFilecoin = $derived(Boolean(profile?.payer && !profile.backupsByCredits));
	const step = $derived.by(() => {
		let n = 1;
		const at = /** @type {Record<string, number>} */ ({ pays: n });
		if (showAleph) at.aleph = ++n;
		if (showFilecoin) at.filecoin = ++n;
		at.relay = ++n;
		at.backups = ++n;
		at.image = ++n;
		at.address = ++n;
		return at;
	});
	// Money for the backups: test coins on Calibration, real ones on mainnet.
	const backupCoins = $derived(profile?.network === 'mainnet' ? x.pays.coinsMain : x.pays.coinsTest);
	// As the browser writes a date in the app's language (German: 1.2.2027).
	const day = (/** @type {string | number} */ at) => format.date(at, {}, $lang);
	/** A paid-until date still ahead, as a date, else ''. @param {string | null} iso */
	const fundedUntil = (iso) => (iso && Date.parse(iso) > Date.now() ? day(iso) : '');
	const until = (s) => (s > 0n && Number(s) * 1000 > Date.now() ? day(Number(s) * 1000) : '');
</script>

<section class="setup" data-testid="setup">
	<h2>{x.title}</h2>
	<details class="where" data-testid="setup-where">
		<summary>{x.where.summary}</summary>
		<p>{x.where.sealed.before}<strong>{x.where.sealed.here}</strong>{x.where.sealed.between}<strong>{x.where.sealed.there}</strong>{x.where.sealed.after}</p>
		<p>{x.where.holds}</p>
		<p>{x.where.sees}
			{x.where.more}<a href="https://github.com/Le-Space/paperless-anywhere/blob/main/docs/keys-and-recovery.md#where-the-setup-is-kept" target="_blank" rel="noopener">{x.where.moreLink}</a>{x.where.moreEnd}</p>
	</details>
	{#if busy === 'wallet'}<p class="waiting" data-testid="wallet-waiting">{x.walletWaiting}</p>{/if}
	{#if !loaded}
		<p>{x.loading}</p>
	{:else}
		<label>
			{x.network.label}
			<select value={profile.network} onchange={(e) => changeNetwork(e.currentTarget.value)} disabled={busy === 'wallet'}>
				<option value="calibration">{x.network.test}</option>
				<option value="mainnet">{x.network.main}</option>
			</select>
		</label>

		<fieldset class="role" disabled={busy === 'role'} data-testid="role">
			<legend>{x.role.legend}</legend>
			<label><input type="radio" name="role" value="test" checked={profile.role !== 'primary'} onchange={() => setRole('test')} data-testid="role-test" /> {x.role.test}</label>
			<label><input type="radio" name="role" value="primary" checked={profile.role === 'primary'} onchange={(e) => setRole('primary', e.currentTarget)} data-testid="role-primary" /> {x.role.primary}</label>
			{#if profile.role === 'primary'}
				<p class="warn" data-testid="role-warning">{x.role.warning}{#if profile.network !== 'mainnet'}{x.role.needsMainnet}{/if}</p>
			{/if}
		</fieldset>
		{@render feedback('network')}{@render feedback('role')}

		<h3>{x.pays.title(step.pays)}</h3>
		<fieldset class="payer-choice" disabled={busy === 'pays'}>
			{#if CREDITS_URL}<label><input type="radio" name="pays" checked={Boolean(profile.leSpacePays)} onchange={() => setPays('lespace')} data-testid="pays-lespace" /> {x.pays.lespace}</label>{/if}
			<label><input type="radio" name="pays" checked={!profile.appPays && !profile.leSpacePays} onchange={() => setPays('wallet')} data-testid="pays-wallet" /> {x.pays.wallet}</label>
			<label><input type="radio" name="pays" checked={Boolean(profile.appPays) && !profile.leSpacePays} onchange={() => setPays('app')} data-testid="pays-app" /> {x.pays.app}</label>
		</fieldset>
		{#if CREDITS_URL}
			<details class="self-pay" data-testid="self-pay">
				<summary>{x.pays.self.summary}</summary>
				<p>{x.pays.self.intro}</p>
				<ul>
					<li><strong>{x.pays.self.walletStrong}</strong>{x.pays.self.wallet(step.aleph ?? 2)}</li>
					<li><strong>{x.pays.self.appStrong}</strong>{x.pays.self.app}</li>
				</ul>
				<p>{x.pays.self.after(step.backups)}</p>
			</details>
		{/if}
		{#if profile.leSpacePays}
			<p class="hint" data-testid="lespace-pays">{x.pays.lespaceHint}{profile.vmOwner ? x.pays.vmAccount : ''}{#if profile.vmOwner}<code>{profile.vmOwner}</code>{/if}</p>
		{:else if profile.appPays}
			<p>{x.pays.appAddress}<code data-testid="app-payer">{pwaAddress}</code>
				<br /><small class="money">{x.pays.appMoney(Boolean(CREDITS_URL))}</small></p>
			<p class="hint">{x.pays.walletOnlyForBackups(CREDITS_URL ? step.backups : null)}</p>
		{/if}
		{#if profile.payer}
			<p>{profile.appPays ? x.pays.walletForBackups : x.pays.connected}: <code data-testid="payer">{profile.payer}</code>
				<br /><small class="money">{profile.appPays ? x.pays.fundsBackups(backupCoins) : x.pays.fundsAll(backupCoins)}{x.pays.keyOnlyWallet}</small></p>
		{/if}
		{@render feedback('pays')}
		<button onclick={connect} disabled={busy === 'wallet'}>{profile.payer ? x.pays.connectOther : profile.appPays ? x.pays.connectForBackups : x.pays.connect}</button>

		{#if showAleph}
			<h3>{x.aleph.title(step.aleph)}</h3>
			<p>{x.aleph.appKey}<code>{pwaAddress}</code>
				<br /><small class="nomoney">{x.aleph.noFunds}</small></p>
			<p data-testid="aleph-status">{alephOk ? x.aleph.granted : x.aleph.notGranted}</p>
			{#if alephOk}
				<button onclick={() => authorize(true)} disabled={busy === 'wallet'}>{x.aleph.revoke}</button>
			{:else}
				<button onclick={() => authorize()} disabled={busy === 'wallet'}>{x.aleph.grant}</button>
			{/if}
		{/if}

		{#if showFilecoin}
			<h3>{x.filecoin.title(step.filecoin)}</h3>
			<p>{x.filecoin.sessionKey}<code>{sessionAddress}</code>
				<br /><small class="nomoney">{x.filecoin.noFunds}</small></p>
			<p data-testid="session-status">{until(sessionUntil) ? x.filecoin.validUntil(until(sessionUntil)) : x.filecoin.notGranted}</p>
			{@render feedback('wallet')}
			<button onclick={() => session()} disabled={busy === 'wallet'}>{until(sessionUntil) ? x.filecoin.extend : x.filecoin.grant}</button>
			{#if until(sessionUntil)}<button onclick={() => session(true)} disabled={busy === 'wallet'}>{x.filecoin.revoke}</button>{/if}
		{/if}

		<h3>{x.relay.title(step.relay)}</h3>
		<p class="hint">{x.relay.hint}</p>
		<p data-testid="relays-found">{x.relay.found}{#if foundRelays === null}…{:else if foundRelays.length}{#each foundRelays as relay, i (relay)}{i ? ', ' : ''}<code>{relay}</code>{/each}{:else}{x.relay.none}{/if}</p>
		<label>{x.relay.own.before}<code>wss://…/attest</code>{x.relay.own.or}<code>/dns4/…/p2p/…</code>{x.relay.own.after}
			<textarea bind:value={relayInput} rows="3" autocomplete="off" spellcheck="false" placeholder={x.relay.placeholder} data-testid="relays"></textarea></label>
		<button onclick={saveRelay} disabled={busy === 'relay'}>{relayInput.trim() || !profile.attestRelay ? x.relay.save : x.relay.remove}</button>
		{@render feedback('relay')}

		<h3>{x.backups.title(step.backups)}</h3>
		{#if CREDITS_URL}
			<fieldset class="payer-choice" disabled={busy === 'bycredits'} data-testid="backups-paid-by">
				<label><input type="radio" name="bypay" checked={!profile.backupsByCredits} onchange={() => setBackupsByCredits(false)} data-testid="backups-wallet" /> {x.backups.byWallet(showFilecoin ? step.filecoin : null)}</label>
				<label><input type="radio" name="bypay" checked={Boolean(profile.backupsByCredits)} onchange={() => setBackupsByCredits(true)} data-testid="backups-credits" /> {x.backups.byCredits}</label>
			</fieldset>
			{#if profile.backupsByCredits}
				<p>{x.backups.vmKey}<code data-testid="backup-key">{backupKey}</code>
					<br /><small class="nomoney">{x.backups.vmKeyHint}</small></p>
				<p data-testid="credits-backup-state">{#if backupState === undefined}…{:else if !backupState}{x.backups.notPaying}{:else}{fundedUntil(backupState.fundedUntil) ? x.backups.paidUntil(fundedUntil(backupState.fundedUntil)) : x.backups.notPaid} · {x.backups.dataSets(backupState.dataSets.length)} · {x.backups.vmKeyState(Boolean(profile.backupSigner?.payer))}{/if}</p>
				<button onclick={payBackups} disabled={busy === 'bycredits'} data-testid="pay-backups">{x.backups.payMonth}</button>
				<br /><small class="hint" data-testid="pay-backups-hint">{x.backups.payHint}</small>
				{#if !profile.backupSigner?.payer}<button onclick={authorizeBackupKey} disabled={busy === 'bycredits'} data-testid="authorize-backup-key">{x.backups.authorizeKey}</button>{/if}
				{@render feedback('bycredits')}
			{/if}
		{/if}
		<label>{x.backups.owner}<input bind:value={ownerInput} placeholder={x.backups.ownerPlaceholder(profile.payer ? profile.payer.slice(0, 10) : null)} /></label>
		<button onclick={saveOwner} disabled={busy === 'owner'}>{x.backups.saveOwner}</button>
		{@render feedback('owner')}
		<p>{x.backups.ageIntro}</p>
		<p data-testid="age-status">{!profile.ageIdentity ? x.backups.age.none : profile.ageIdentity === vaultAge ? x.backups.age.vault : x.backups.age.pasted}</p>
		{#if recipient}<p><small>{x.backups.recipient}<code data-testid="age-recipient">{recipient}</code></small></p>{/if}
		{#if profile.ageIdentity !== vaultAge}<button onclick={useVaultAge} disabled={busy === 'age'}>{x.backups.useVault}</button>{/if}
		<details>
			<summary>{x.backups.paste}</summary>
			<textarea bind:value={ageInput} rows="2" autocomplete="off" spellcheck="false" placeholder="AGE-SECRET-KEY-1…"></textarea>
			<button onclick={saveAge} disabled={busy === 'age' || !ageInput.trim()}>{x.backups.seal}</button>
		</details>
		{@render feedback('age')}
		<label class="check">
			<input type="checkbox" data-testid="backups-on" checked={!!profile.backupConfig} disabled={busy === 'backups' || (!profile.backupConfig && profile.network === 'mainnet' && profile.role !== 'primary')}
				onchange={(e) => toggleBackups(e.currentTarget.checked)} />
			{x.backups.on.before(profile.network === 'mainnet')}<code>{BACKUP_LABEL[profile.network === 'mainnet' ? 'mainnet' : 'calibration']}</code>{x.backups.on.after}
		</label>
		{#if profile.backupConfig}
			<BackupPlaces network={profile.network} payer={profile.backupOwner || (profile.backupsByCredits ? '' : profile.payer)} config={profile.backupConfig} busy={busy === 'places'} onsave={savePlaces} />
		{/if}
		{@render feedback('backups')}{@render feedback('places')}
		{#if profile.network === 'mainnet' && profile.role !== 'primary'}<p class="hint" data-testid="mainnet-backup-hint">{x.backups.mainnetHint}</p>
		{:else if profile.backupConfig && profile.backupsByCredits && (!profile.backupSigner?.payer || (backupState && !fundedUntil(backupState.fundedUntil)))}<p class="hint" data-testid="credits-backup-hint">{x.backups.creditsHint}</p>
		{:else if profile.backupConfig && !profile.backupsByCredits && !until(sessionUntil)}<p class="hint">{x.backups.sessionHint(step.filecoin)}</p>{/if}

		<h3>{x.image.title(step.image)}</h3>
		{#if BUILDER}
			<fieldset class="image-choice" data-testid="image-choice">
				<legend>{$t.ownImage.choice.legend}</legend>
				<label><input type="radio" bind:group={imageKind} value="public" onchange={choosePublic} data-testid="image-public" /> {$t.ownImage.choice.public}<br /><small>{$t.ownImage.choice.publicHint}</small></label>
				<label><input type="radio" bind:group={imageKind} value="own" data-testid="image-own" /> {$t.ownImage.choice.own}<br /><small>{$t.ownImage.choice.ownHint}</small></label>
			</fieldset>
		{/if}
		{#if publicImage}
			<label>{x.image.hash}<input bind:value={imageInput} placeholder={x.image.hashPlaceholder} data-testid="image-hash" /></label>
		{/if}
		<label>{x.image.node}<input bind:value={crnInput} placeholder={x.image.nodePlaceholder} /></label>
		{#if publicImage}
			<label>{x.image.pass}<input bind:value={passInput} type="password" autocomplete="off" data-testid="image-passphrase" placeholder={profile.luksPassphrase && !ownBuilt ? x.image.passKept(profile.luksPassphrase.length) : x.image.pass} /></label>
		{/if}
		<button onclick={saveImage} disabled={busy === 'image'}>{publicImage ? x.image.saveBoth : x.image.saveNode}</button>
		{@render feedback('image')}
		{#if BUILDER && !publicImage}
			<div class="own-image" data-testid="own-image">
				{#if !ownBuilt}<p class="warn" data-testid="own-image-not-built">{$t.ownImage.choice.notBuilt}</p>{/if}
				<p class="hint">{$t.ownImage.intro.before}<code>{pwaAddress}</code>{$t.ownImage.intro.after}</p>
				<details class="sources" data-testid="own-image-sources">
					<summary>{$t.ownImage.sourcesFold}</summary>
					<p class="hint">{$t.ownImage.sourcesHint}</p>
					<dl>
						{#each sources(BUILDER, $t.ownImage.sources) as row}
							<dt>{row.label}</dt>
							<dd>{#if row.href}<a href={row.href} target="_blank" rel="noreferrer"><code>{row.value}</code></a>{:else}<code>{row.value}</code>{/if}</dd>
						{/each}
					</dl>
				</details>
				{#if ownBuilt}<p class="saved" data-testid="own-image-have">{$t.ownImage.have(format.date(profile.ownImage.builtAt, undefined, $lang))}</p>{/if}
				{#if affordable === null}<p class="hint" data-testid="own-image-checking">{$t.ownImage.choice.checking}</p>
				{:else if affordable.ok === false && affordable.reason}<p class="warn" data-testid="own-image-package-no">{affordable.reason}</p>
				{:else if affordable.ok === false}<p class="warn" data-testid="own-image-needs-credits">{$t.ownImage.choice.needsCredits(format.number(affordable.need ?? 0, undefined, $lang), format.number(affordable.have ?? 0, undefined, $lang))}</p>
				{:else}{#if affordable.price != null}<p class="hint" data-testid="own-image-price">{$t.ownImage.choice.price(format.euro(affordable.price, $lang))}</p>{/if}<button onclick={buildImage} data-testid="own-image-build" disabled={busy === 'own-image' || Boolean(profile.running)}>{ownBuilt ? $t.ownImage.rebuild : $t.ownImage.build}</button>{/if}
				{#if profile.running}<p class="hint">{$t.ownImage.whileRunning}</p>{/if}
				{#if busy === 'own-image' && ownStep}<p class="hint" role="status" data-testid="own-image-step">{ownStep} …</p>{/if}
				{@render feedback('own-image')}
			</div>
		{/if}

		<h3>{x.address.title(step.address)}</h3>
		<p class="hint">{x.address.hint.before(FIXED_HOST_DOMAIN.split('.').slice(-2).join('.'))}<code>{fixedHostLabel(master)}.{FIXED_HOST_DOMAIN}</code>{x.address.hint.between}<code>*.2n6.me</code>{x.address.hint.after}</p>
		<label>{x.address.token}<input bind:value={dnsInput} type="password" autocomplete="off" data-testid="dns-token" placeholder={profile.dnsToken ? x.address.tokenKept : x.address.token} /></label>
		<button onclick={saveDns} disabled={busy === 'dns'}>{profile.dnsToken && !dnsInput.trim() ? x.address.remove : x.address.save}</button>
		{@render feedback('dns')}
	{/if}
	{#if error && !errorKey}<p class="error" role="alert">{error}</p>{/if}
</section>

{#snippet feedback(/** @type {string} */ key)}
	{#if error && errorKey === key}<p class="error" role="alert" data-testid={`error-${key}`}>{error}</p>
	{:else if savedKey === key}<p class="saved" data-testid={`saved-${key}`}>{x.saved}</p>{/if}
{/snippet}

<style>
	.sources { margin: 0.25rem 0 0.75rem; font-size: 0.9rem; }
	.sources summary { cursor: pointer; }
	.sources dt { color: var(--text-2); margin-top: 0.5rem; }
	.sources dd { margin: 0; overflow-wrap: anywhere; }
	.image-choice { border: none; padding: 0; margin: 0 0 0.75rem; }
	.image-choice label { display: block; margin: 0.25rem 0; }
	.own-image { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--line); }
	.self-pay { margin: 0.25rem 0 0.75rem; font-size: 0.95rem; color: var(--text-2); }
	.self-pay summary { cursor: pointer; }
	.self-pay ul { padding-left: 1.2rem; }
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
