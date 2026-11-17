<script>
	import { balancesRound, refreshBalances } from '$lib/balance-refresh.js';
	import Addr from '$lib/Addr.svelte';
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey, fixedHostLabel } from '$lib/keys/derive.js';
	import { FIXED_HOST_DOMAIN } from '$lib/vm.js';
	import { loadProfile, updateProfile } from '$lib/profile.js';
	import { ageIdentityFromMaster, ageRecipient } from '$lib/keys/age.js';
	import { BACKUP_LABEL, backupConfigFor, supportsIncremental } from '$lib/backups.js';
	import { relayList } from '$lib/attest-p2p.js';
	import { findAttestRelays } from '$lib/relays.js';
	import { backupAuthorize, backupKeyAddress, CREDITS_URL, creditsBalance, creditsCatalog, fundBackups, imageBuild, imageBuildDone, CreditsShortError } from '$lib/credits.js';
	import BackupPlaces from '$lib/BackupPlaces.svelte';
	import { buildImageForVault, forgetOldImage } from '$lib/own-image-build.js';
	import { forgetQueued } from '$lib/old-image.js';
	import { buildsImageFirst, pushBackupPlaces } from '$lib/lifecycle.js';
	import { BUILDER, buildAffordable, forgetLeftBuilder, settleLeftBuild, hasOwnImage, imageFields, imageKindOf, sources } from '$lib/own-image.js';
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
	let { master, version = 0, onsaved = () => {} } = $props();
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

	// Changed elsewhere (defaults set by the package card, another view): the
	// stored values again, without touching what is typed or a running build.
	let seenVersion = version;
	$effect(() => {
		const v = version;
		if (!loaded || v === seenVersion) return;
		seenVersion = v;
		if (busy) return;
		loadProfile(master)
			.then(async (p) => {
				profile = { network: 'calibration', ...p };
				await refresh();
			})
			.catch(() => {});
	});

	$effect(() => {
		loadProfile(master)
			.then(async (p) => {
				profile = { network: 'calibration', ...p };
				relayInput = profile.attestRelay ?? '';
				imageInput = profile.rootfsItemHash ?? '';
				ownerInput = profile.backupOwner ?? '';
				crnInput = profile.crnHash ?? '';
				// A Paperless Le Space pays that has no image yet builds its own at
				// the first start (buildsImageFirst): the own image is the choice.
				imageKind = buildsImageFirst(profile, BUILDER) ? 'own' : imageKindOf(profile, BUILDER);
				loaded = true;
				// A build's builder that a closed window left running: forget it now.
				// What a closed window or a lost report left: its builder forgotten,
				// its end reported to Le Space Credits, then the note goes.
				if (profile.ownBuilder) {
					settleLeftBuild(privateKeyToAccount(alephPrivateKey(master)), profile, { done: (d) => imageBuildDone(master, d) })
						.then((settled) => settled && save({ ownBuilder: null }))
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
		refreshBalances();
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
	// Saved while Paperless runs: the next step is handing them to the VM, offered at once.
	let placesPending = $state(false);
	const savePlaces = (places) => run('places', async () => {
		await save({ backupConfig: backupConfigFor(profile.network, ageRecipient(profile.ageIdentity || vaultAge), places) });
		if (profile.running) placesPending = true;
	});
	// A VM that runs reads its backup places at every backup: changed places
	// reach it only when handed over (pushBackupPlaces, over the attested channel).
	const pushPlaces = () => run('places-push', async () => {
		await pushBackupPlaces(master, profile);
		placesPending = false;
		// The card reads the backup list again, and the lights at the top with it.
		onsaved();
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
	// "Mein Image bauen": this vault's own copy of the base image, sealed by
	// the attested builder with a passphrase derived from the master secret
	// (own-image.js). Shown only when a builder is fixed in the app.
	let ownStep = $state('');
	// Which image: the public one, whose passphrase Le Space and everyone using
	// that version know, or this vault's own. Shown only when a builder is fixed.
	/** @type {'public' | 'own'} */
	let imageKind = $state('public');
	// Until the person picks one, the choice follows what the profile says.
	// The profile changes after loading too: a voucher or package sets "Le
	// Space pays" (customer defaults), and the first start then builds the
	// own image, so the choice must not stay on the public one shown at load.
	let imageKindPicked = false;
	/** @type {string | null} */
	let suggested = null;
	$effect(() => {
		if (!BUILDER || !loaded) return;
		// Depends on the profile only, so a click on a radio does not re-run it.
		const kind = buildsImageFirst(profile, BUILDER) ? 'own' : imageKindOf(profile, BUILDER);
		if (kind === suggested) return;
		suggested = kind;
		if (!imageKindPicked) imageKind = kind;
	});
	const publicImage = $derived(!BUILDER || imageKind === 'public');
	// Whether the app address can pay a build now (a day of the builder, the
	// image's storage and what it already pays): the build is offered only
	// then. Unknown (Aleph not asked) offers it, and Aleph's answer decides.
	// With a Le Space package the package pays (Le Space Credits): its price
	// for one build, or why it cannot (no package, too little balance).
	/** @type {{ ok: boolean | null, need?: number | null, have?: number | null, price?: number | null, included?: boolean, reason?: string, short?: boolean } | null} */
	let affordable = $state(null);
	const packagePays = $derived(Boolean(profile?.leSpacePays && CREDITS_URL));
	// Asked again when who pays changes and in every new balance round
	// (balance-refresh.js: the reload button, a top-up, the window back in
	// view); an answer for an earlier choice or round is dropped.
	const affordableKey = $derived(`${packagePays}|${profile?.appPays ? 'app' : profile?.leSpacePays ? 'lespace' : 'wallet'}|${profile?.payer ?? ''}|${$balancesRound}`);
	let affordableFor = '';
	$effect(() => {
		if (!BUILDER || imageKind !== 'own' || !loaded) return;
		const key = affordableKey;
		if (key === affordableFor) return;
		affordableFor = key;
		affordable = null;
		const answer = (/** @type {NonNullable<typeof affordable>} */ a) => {
			if (affordableFor === key) affordable = a;
		};
		if (packagePays)
			imageBuild(master, { quote: true, version: BUILDER.plain.sha256 })
				.then((q) => answer({ ok: true, price: q.chargedCredits, included: q.included }))
				.catch((e) =>
					answer({
						ok: false,
						reason:
							e instanceof TypeError ? $t.ownImage.choice.creditsUnreachable
							: e instanceof CreditsShortError ? $t.ownImage.choice.packageShort(e.price != null ? format.euro(e.price, $lang) : null, e.neededCredits != null ? format.euro(e.neededCredits, $lang) : null)
							: e.message,
						short: e instanceof CreditsShortError
					})
				);
		else buildAffordable(privateKeyToAccount(alephPrivateKey(master)), /** @type {any} */ (BUILDER)).then(answer);
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
			const built = await buildImageForVault({
				master,
				profile,
				packagePays,
				confirm: (question) => confirm(question),
				save,
				onProgress: ({ detail }) => (ownStep = detail ?? '')
			});
			if (!built) return;
			await save(built);
			imageInput = built.rootfsItemHash;
			passInput = '';
		} finally {
			ownStep = '';
		}
	});
	// Old own images whose FORGET failed: by hand (old-image.js).
	const removeOldImages = () => run('old-images', async () => {
		const app = privateKeyToAccount(alephPrivateKey(master));
		const left = await forgetQueued(profile, (store) => forgetOldImage(app, store));
		await save({ oldOwnImages: left.length ? left : undefined });
		if (left.length) throw new Error(tr().ownImage.oldPending(left.length));
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
	// When Le Space pays, relay and backup details are a developer's business:
	// they move into one fold at the end, unnumbered, and a customer sees three
	// steps (who pays, image, fixed address).
	const devSteps = $derived(Boolean(profile?.leSpacePays));
	const step = $derived.by(() => {
		let n = 1;
		const at = /** @type {Record<string, number>} */ ({ pays: n });
		if (showAleph) at.aleph = ++n;
		if (showFilecoin) at.filecoin = ++n;
		if (!devSteps) {
			at.relay = ++n;
			at.backups = ++n;
		}
		at.image = ++n;
		at.address = ++n;
		return at;
	});
	/** A step's title, numbered when it is a numbered step. @param {(n: number) => string} title @param {number | undefined} n */
	const titled = (title, n) => (n ? title(n) : title(0).replace(/^0\.\s*/, ''));
	// Money for the backups: test coins on Calibration, real ones on mainnet.
	const backupCoins = $derived(profile?.network === 'mainnet' ? x.pays.coinsMain : x.pays.coinsTest);
	// As the browser writes a date in the app's language (German: 1.2.2027).
	const day = (/** @type {string | number} */ at) => format.date(at, {}, $lang);
	/** A paid-until date still ahead, as a date, else ''. @param {string | null} iso */
	const fundedUntil = (iso) => (iso && Date.parse(iso) > Date.now() ? day(iso) : '');
	const until = (s) => (s > 0n && Number(s) * 1000 > Date.now() ? day(Number(s) * 1000) : '');

	// "At a glance": one line per step, what is set and whether it is done.
	const o = $derived(x.overview);
	const status = $derived.by(() => {
		if (!profile) return [];
		/** @type {{ key: string, label: string, value: string, ok: boolean }[]} */
		const rows = [];
		const pays = profile.leSpacePays ? o.pays.lespace : profile.appPays ? o.pays.app : profile.payer ? o.pays.wallet : o.pays.none;
		rows.push({ key: 'pays', label: o.labels.pays, value: pays, ok: Boolean(profile.leSpacePays || profile.appPays || profile.payer) });
		if (showAleph) rows.push({ key: 'aleph', label: o.labels.aleph, value: alephOk ? o.aleph.ok : o.aleph.no, ok: alephOk });
		if (showFilecoin) rows.push({ key: 'filecoin', label: o.labels.filecoin, value: until(sessionUntil) ? o.filecoin.ok(until(sessionUntil)) : o.filecoin.no, ok: Boolean(until(sessionUntil)) });
		const relayValue = profile.attestRelay ? o.relay.own : foundRelays === null ? o.relay.looking : foundRelays.length ? o.relay.found(foundRelays.length) : o.relay.none;
		rows.push({ key: 'relay', label: o.labels.relay, value: relayValue, ok: Boolean(profile.attestRelay || foundRelays?.length) });
		const paid = profile.backupsByCredits && backupState ? fundedUntil(backupState.fundedUntil) : '';
		const backups = !profile.backupConfig ? o.backups.off : !profile.ageIdentity ? o.backups.noKey : paid ? o.backups.paidUntil(paid) : o.backups.on;
		rows.push({ key: 'backups', label: o.labels.backups, value: backups, ok: Boolean(profile.backupConfig && profile.ageIdentity) });
		const own = BUILDER && imageKind === 'own';
		const image = ownBuilt ? o.image.own(day(profile.ownImage.builtAt)) : own ? (buildsImageFirst(profile, BUILDER) ? o.image.ownAtStart : o.image.ownMissing) : profile.rootfsItemHash ? o.image.public : o.image.none;
		rows.push({ key: 'image', label: o.labels.image, value: image, ok: Boolean(ownBuilt || (own && buildsImageFirst(profile, BUILDER)) || (!own && profile.rootfsItemHash && profile.luksPassphrase)) });
		rows.push({ key: 'address', label: o.labels.address, value: profile.dnsToken ? o.address.on : o.address.off, ok: true });
		return rows;
	});
	// Which steps are open: the ones not done when they first show; after that
	// the person opens and closes them (a save does not fold a step away).
	/** @type {Record<string, boolean>} */
	let opened = $state({});
	// A step that shows up later (the Aleph step once a wallet pays) opens the same way.
	$effect(() => {
		if (!loaded) return;
		const fresh = status.filter((r) => !(r.key in opened));
		if (fresh.length) opened = { ...opened, ...Object.fromEntries(fresh.map((r) => [r.key, !r.ok])) };
	});
	/** Open a step from the overview and bring it into view. @param {string} key */
	function goTo(key) {
		if (devSteps && (key === 'relay' || key === 'backups')) devOpen = true;
		opened = { ...opened, [key]: true };
		requestAnimationFrame(() => document.getElementById(`setup-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
	}
	let devOpen = $state(false);
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
		<div class="overview" data-testid="setup-overview">
			<h4>{o.title}</h4>
			<ul>
				{#each status as row (row.key)}
					<li class:todo={!row.ok} data-testid={`overview-${row.key}`}>
						<span class="mark" aria-hidden="true">{row.ok ? '✓' : '•'}</span>
						<span class="what">{row.label}</span>
						<span class="value">{row.value}</span>
						<button type="button" class="link" onclick={() => goTo(row.key)}>{o.open}</button>
					</li>
				{/each}
			</ul>
		</div>
		{#if !devSteps}{@render networkRole()}{/if}

		<details class="step" id="setup-pays" data-testid="step-pays" bind:open={opened.pays}>
			<summary><h3>{x.pays.title(step.pays)}</h3></summary>
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
				<p class="hint" data-testid="lespace-pays">{x.pays.lespaceHint}{profile.vmOwner ? x.pays.vmAccount : ''}{#if profile.vmOwner}<Addr value={profile.vmOwner} />{/if}</p>
			{:else if profile.appPays}
				<p>{x.pays.appAddress}<Addr value={pwaAddress} testid="app-payer" />
					<br /><small class="money">{x.pays.appMoney(Boolean(CREDITS_URL))}</small></p>
				<p class="hint">{x.pays.walletOnlyForBackups(CREDITS_URL ? step.backups : null)}</p>
			{/if}
			{#if profile.payer}
				<p>{profile.appPays ? x.pays.walletForBackups : x.pays.connected}: <Addr value={profile.payer} testid="payer" />
					<br /><small class="money">{profile.appPays ? x.pays.fundsBackups(backupCoins) : x.pays.fundsAll(backupCoins)}{x.pays.keyOnlyWallet}</small></p>
			{/if}
			{@render feedback('pays')}
			<button onclick={connect} disabled={busy === 'wallet'}>{profile.payer ? x.pays.connectOther : profile.appPays ? x.pays.connectForBackups : x.pays.connect}</button>
		</details>

		{#if showAleph}
			<details class="step" id="setup-aleph" data-testid="step-aleph" bind:open={opened.aleph}>
				<summary><h3>{x.aleph.title(step.aleph)}</h3></summary>
				<p>{x.aleph.appKey}<Addr value={pwaAddress} />
					<br /><small class="nomoney">{x.aleph.noFunds}</small></p>
				<p data-testid="aleph-status">{alephOk ? x.aleph.granted : x.aleph.notGranted}</p>
				{#if alephOk}
					<button onclick={() => authorize(true)} disabled={busy === 'wallet'}>{x.aleph.revoke}</button>
				{:else}
					<button onclick={() => authorize()} disabled={busy === 'wallet'}>{x.aleph.grant}</button>
				{/if}
			</details>
		{/if}

		{#if showFilecoin}
			<details class="step" id="setup-filecoin" data-testid="step-filecoin" bind:open={opened.filecoin}>
				<summary><h3>{x.filecoin.title(step.filecoin)}</h3></summary>
				<p>{x.filecoin.sessionKey}<Addr value={sessionAddress} />
					<br /><small class="nomoney">{x.filecoin.noFunds}</small></p>
				<p data-testid="session-status">{until(sessionUntil) ? x.filecoin.validUntil(until(sessionUntil)) : x.filecoin.notGranted}</p>
				{@render feedback('wallet')}
				<button onclick={() => session()} disabled={busy === 'wallet'}>{until(sessionUntil) ? x.filecoin.extend : x.filecoin.grant}</button>
				{#if until(sessionUntil)}<button onclick={() => session(true)} disabled={busy === 'wallet'}>{x.filecoin.revoke}</button>{/if}
			</details>
		{/if}

		{#if !devSteps}{@render relayAndBackups()}{/if}

		<details class="step" id="setup-image" data-testid="step-image" bind:open={opened.image}>
			<summary><h3>{x.image.title(step.image)}</h3></summary>
			{#if BUILDER}
				<fieldset class="image-choice" data-testid="image-choice">
					<legend>{$t.ownImage.choice.legend}</legend>
					<label><input type="radio" bind:group={imageKind} value="own" onchange={() => (imageKindPicked = true)} data-testid="image-own" /> {$t.ownImage.choice.own}<br /><small>{$t.ownImage.choice.ownHint}</small></label>
					<label><input type="radio" bind:group={imageKind} value="public" onchange={() => ((imageKindPicked = true), choosePublic())} data-testid="image-public" /> {$t.ownImage.choice.public}<br /><small>{$t.ownImage.choice.publicHint}</small></label>
					<details class="more"><summary>{x.more}</summary><p class="hint">{$t.ownImage.choice.publicWhy}</p></details>
				</fieldset>
			{/if}
			{#if BUILDER && publicImage}
				<p class="tip" data-testid="own-image-tip">{$t.ownImage.tip}</p>
				<p class="warn-line" data-testid="public-limits">{profile.role === 'primary' ? $t.ownImage.choice.primaryNeedsOwn : $t.ownImage.choice.publicLimits}</p>
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
					{#if !ownBuilt && buildsImageFirst(profile, BUILDER)}<p class="hint" data-testid="own-image-at-start">{$t.ownImage.choice.builtAtStart}</p>
					{:else if !ownBuilt}<p class="warn" data-testid="own-image-not-built">{$t.ownImage.choice.notBuilt}</p>{/if}
					<details class="more"><summary>{x.more}</summary><p class="hint">{$t.ownImage.intro.before}<Addr value={pwaAddress} />{$t.ownImage.intro.after}</p></details>
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
					{#if profile.oldOwnImages?.length}<p class="hint" data-testid="old-images">{$t.ownImage.oldPending(profile.oldOwnImages.length)} <button class="link" onclick={removeOldImages} disabled={busy === 'old-images'} data-testid="old-images-remove">{$t.ownImage.oldRemove}</button></p>{/if}{@render feedback('old-images')}
					{#if affordable === null}<p class="hint" data-testid="own-image-checking">{$t.ownImage.choice.checking}</p>
					{:else if affordable.ok === false && affordable.reason}<p class="error alert" role="alert" data-testid="own-image-package-no">{affordable.reason}{#if affordable.short} <a href="#paket">{$t.ownImage.choice.toTopUp}</a>{/if} <button class="link" onclick={() => refreshBalances()} data-testid="own-image-recheck">{$t.ownImage.choice.recheck}</button></p>
					{:else if affordable.ok === false}<p class="error alert" role="alert" data-testid="own-image-needs-credits">{$t.ownImage.choice.needsCredits(format.number(affordable.need ?? 0, undefined, $lang), format.number(affordable.have ?? 0, undefined, $lang))} <button class="link" onclick={() => refreshBalances()} data-testid="own-image-recheck">{$t.ownImage.choice.recheck}</button></p>
					{:else}{#if affordable.included}<p class="hint" data-testid="own-image-price">{$t.ownImage.choice.included}</p>{:else if affordable.price != null}<p class="hint" data-testid="own-image-price">{$t.ownImage.choice.price(format.euro(affordable.price, $lang))}</p>{/if}<button onclick={buildImage} data-testid="own-image-build" disabled={busy === 'own-image' || Boolean(profile.running)}>{ownBuilt ? $t.ownImage.rebuild : $t.ownImage.build}</button>{/if}
					{#if profile.running}<p class="hint">{$t.ownImage.whileRunning}</p>{/if}
					{#if busy === 'own-image' && ownStep}<p class="hint" role="status" data-testid="own-image-step">{ownStep} …</p>{/if}
					{@render feedback('own-image')}
				</div>
			{/if}
		</details>

		<details class="step" id="setup-address" data-testid="step-address" bind:open={opened.address}>
			<summary><h3>{x.address.title(step.address)}</h3></summary>
			<p class="hint">{x.address.hint.before(FIXED_HOST_DOMAIN.split('.').slice(-2).join('.'))}<code>{fixedHostLabel(master)}.{FIXED_HOST_DOMAIN}</code>{x.address.hint.between}<code>*.2n6.me</code>{x.address.hint.after}</p>
			<label>{x.address.token}<input bind:value={dnsInput} type="password" autocomplete="off" data-testid="dns-token" placeholder={profile.dnsToken ? x.address.tokenKept : x.address.token} /></label>
			<button onclick={saveDns} disabled={busy === 'dns'}>{profile.dnsToken && !dnsInput.trim() ? x.address.remove : x.address.save}</button>
			{@render feedback('dns')}
		</details>
		{#if devSteps}
			<!-- Le Space pays: network, role, relay and backup details stay reachable, folded. -->
			<details class="dev" data-testid="dev-fold" bind:open={devOpen}>
				<summary>{x.devFold(profile.network === 'mainnet' ? x.network.main : x.network.test)}</summary>
				{@render networkRole()}
				{@render relayAndBackups()}
			</details>
		{/if}
	{/if}
	{#if error && !errorKey}<p class="error" role="alert">{error}</p>{/if}
</section>

{#snippet relayAndBackups()}
	<details class="step" id="setup-relay" data-testid="step-relay" bind:open={opened.relay}>
		<summary><h3>{titled(x.relay.title, step.relay)}</h3></summary>
	<details class="more"><summary>{x.more}</summary><p class="hint">{x.relay.hint}</p></details>
	<p data-testid="relays-found">{x.relay.found}{#if foundRelays === null}…{:else if foundRelays.length}{#each foundRelays as relay, i (relay)}{i ? ', ' : ''}<code>{relay}</code>{/each}{:else}{x.relay.none}{/if}</p>
	<label>{x.relay.own.before}<code>wss://…/attest</code>{x.relay.own.or}<code>/dns4/…/p2p/…</code>{x.relay.own.after}
		<textarea bind:value={relayInput} rows="3" autocomplete="off" spellcheck="false" placeholder={x.relay.placeholder} data-testid="relays"></textarea></label>
	<button onclick={saveRelay} disabled={busy === 'relay'}>{relayInput.trim() || !profile.attestRelay ? x.relay.save : x.relay.remove}</button>
	{@render feedback('relay')}
	</details>
	<details class="step" id="setup-backups" data-testid="step-backups" bind:open={opened.backups}>
		<summary><h3>{titled(x.backups.title, step.backups)}</h3></summary>
	{#if CREDITS_URL}
		<fieldset class="payer-choice" disabled={busy === 'bycredits'} data-testid="backups-paid-by">
			<label><input type="radio" name="bypay" checked={!profile.backupsByCredits} onchange={() => setBackupsByCredits(false)} data-testid="backups-wallet" /> {x.backups.byWallet(showFilecoin ? step.filecoin : null)}</label>
			<label><input type="radio" name="bypay" checked={Boolean(profile.backupsByCredits)} onchange={() => setBackupsByCredits(true)} data-testid="backups-credits" /> {x.backups.byCredits}</label>
		</fieldset>
		{#if profile.backupsByCredits}
			<p>{x.backups.vmKey}<Addr value={backupKey} testid="backup-key" />
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
	<details class="more"><summary>{x.more}</summary><p>{x.backups.ageIntro}</p></details>
	<p data-testid="age-status">{!profile.ageIdentity ? x.backups.age.none : profile.ageIdentity === vaultAge ? x.backups.age.vault : x.backups.age.pasted}</p>
	{#if recipient}<p><small>{x.backups.recipient}<Addr value={recipient} testid="age-recipient" /></small></p>{/if}
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
		<span>{x.backups.on.before(profile.network === 'mainnet')}<code>{BACKUP_LABEL[profile.network === 'mainnet' ? 'mainnet' : 'calibration']}</code>{x.backups.on.after}</span>
	</label>
	{#if profile.backupConfig}
		<BackupPlaces network={profile.network} payer={profile.backupOwner || (profile.backupsByCredits ? '' : profile.payer)} config={profile.backupConfig} busy={busy === 'places'} incrementalReady={supportsIncremental(profile)} onsave={savePlaces} />
		{#if profile.running}
			<div class="push-places" class:pending={placesPending} data-testid="places-push-box">
				<p>{placesPending ? $t.backup.places.pushPending : $t.backup.places.pushHint}</p>
				<button onclick={pushPlaces} disabled={busy === 'places-push'} data-testid="places-push">{$t.backup.places.push}</button>
			</div>
			{@render feedback('places-push')}
		{/if}
	{/if}
	{@render feedback('backups')}{@render feedback('places')}
	{#if profile.network === 'mainnet' && profile.role !== 'primary'}<p class="hint" data-testid="mainnet-backup-hint">{x.backups.mainnetHint}</p>
	{:else if profile.backupConfig && profile.backupsByCredits && (!profile.backupSigner?.payer || (backupState && !fundedUntil(backupState.fundedUntil)))}<p class="hint" data-testid="credits-backup-hint">{x.backups.creditsHint}</p>
	{:else if profile.backupConfig && !profile.backupsByCredits && !until(sessionUntil)}<p class="hint">{x.backups.sessionHint(step.filecoin)}</p>{/if}
	</details>
{/snippet}

{#snippet networkRole()}
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
{/snippet}

{#snippet feedback(/** @type {string} */ key)}
	{#if error && errorKey === key}<p class="error alert" role="alert" data-testid={`error-${key}`}>{error}</p>
	{:else if savedKey === key}<p class="saved" data-testid={`saved-${key}`}>{x.saved}</p>{/if}
{/snippet}

<style>
	.sources { margin: 0.25rem 0 0.75rem; font-size: 0.9rem; }
	.sources summary { cursor: pointer; }
	.sources dt { color: var(--text-2); margin-top: 0.5rem; }
	.sources dd { margin: 0; overflow-wrap: anywhere; }
	.dev { margin: 0.25rem 0 0.75rem; }
	.dev summary { cursor: pointer; color: var(--text-2); }
	.image-choice { border: none; padding: 0; margin: 0 0 0.75rem; }
	.image-choice label { display: block; margin: 0.25rem 0; }
	/* The radio before its label, not stretched above it like the text inputs. */
	.image-choice input[type='radio'] { width: auto; margin: 0 0.4rem 0 0; vertical-align: middle; }
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
	/* A message that must not go unseen: framed, tinted, like a callout. */
	.alert { border: 1px solid var(--danger); border-left-width: 4px; border-radius: var(--radius-sm, 6px); padding: 0.6rem 0.8rem; background: color-mix(in srgb, var(--danger) 8%, transparent); }
	.overview { margin: 0.5rem 0 1rem; padding: 0.6rem 0.8rem; border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); }
	.overview h4 { margin: 0 0 0.4rem; font-size: 0.95rem; }
	.overview ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; }
	.overview li { display: grid; grid-template-columns: 1.2rem minmax(7rem, auto) 1fr auto; gap: 0.5rem; align-items: baseline; font-size: 0.92rem; }
	.overview .mark { color: var(--ok); }
	.overview li.todo .mark, .overview li.todo .value { color: var(--warn); }
	.overview .what { color: var(--text-2); }
	.overview .link { font-size: 0.85rem; color: var(--text-2); }
	@media (max-width: 480px) { .overview li { grid-template-columns: 1.2rem 1fr auto; } .overview .value { grid-column: 2 / 3; } }
	.step { border-top: 1px solid var(--line); padding: 0.25rem 0 0.5rem; }
	.step > summary { cursor: pointer; }
	.step > summary h3 { display: inline; margin: 0; font-size: 1rem; }
	.step[open] > summary { margin-bottom: 0.5rem; }
	.step > summary { padding: 0.6rem 0; }
	.more { margin: 0.25rem 0 0.5rem; font-size: 0.9rem; color: var(--text-2); }
	.more summary { cursor: pointer; }
	.tip { margin: 0 0 0.75rem; padding: 0.5rem 0.75rem; border-left: 3px solid var(--ok); background: color-mix(in srgb, var(--ok) 8%, transparent); border-radius: var(--radius-sm, 6px); font-size: 0.92rem; }
	.warn-line { color: var(--warn); font-size: 0.9rem; margin: 0 0 0.75rem; }
	.push-places { margin: 0.5rem 0; }
	.push-places p { margin: 0.25rem 0; font-size: 0.9rem; color: var(--text-2); }
	.push-places.pending { padding: 0.6rem 0.8rem; border: 1px solid var(--accent, var(--ok)); border-left-width: 4px; border-radius: var(--radius-sm, 6px); background: var(--warn-bg); }
	.push-places.pending p { color: var(--text); font-weight: 600; }
	.link { background: none; border: none; color: inherit; text-decoration: underline; padding: 0; font: inherit; cursor: pointer; }
</style>
