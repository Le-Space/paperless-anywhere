// The setup's flow control: who pays, the grants, relays, backups, image and fixed address, and every action on them.
// Moved here unchanged from Setup.svelte, so that more than one interface can
// draw it: the component keeps the markup, this module keeps what happens.
// Call it while a component is set up (it uses effects).
import { balancesRound, refreshBalances } from '$lib/balance-refresh.js';
import { privateKeyToAccount } from 'viem/accounts';
import { alephPrivateKey } from '$lib/keys/derive.js';
import { loadProfile, updateProfile } from '$lib/profile.js';
import { ageIdentityFromMaster, ageRecipient } from '$lib/keys/age.js';
import { backupConfigFor } from '$lib/backups.js';
import { relayList } from '$lib/attest-p2p.js';
import { findAttestRelays } from '$lib/relays.js';
import { backupAuthorize, backupKeyAddress, CREDITS_URL, creditsBalance, creditsCatalog, fundBackups, imageBuild, imageBuildDone, CreditsShortError } from '$lib/credits.js';
import { buildImageForVault, forgetOldImage } from '$lib/own-image-build.js';
import { forgetQueued } from '$lib/old-image.js';
import { buildsImageFirst, pushBackupPlaces } from '$lib/lifecycle.js';
import { BUILDER, buildAffordable, settleLeftBuild, hasOwnImage, imageFields, imageKindOf } from '$lib/own-image.js';
import { format, lang, t, tr } from '$lib/i18n/index.js';
import { connectPayer, isAuthorized, readAuthorizations, sessionKeyAddress, sessionKeyExpiry, setAlephAuthorization, setFilecoinSessionKey } from '$lib/permissions.js';
import { fromStore } from 'svelte/store';

/** @param {Record<string, any>} p the component's props: master, version through getters, so they follow; onsaved as functions */
export function createSetupCard(p) {
	// The stores, read as the component read them with `$`.
	const balancesRoundNow = fromStore(balancesRound);
	const langNow = fromStore(lang);
	const tNow = fromStore(t);

	const master = $derived(p.master);
	const version = $derived(p.version);
	const { onsaved } = p;
	// A question to the person: the host's own dialog where it has one (v0.2), else the browser's.
	const ask = async (/** @type {string} */ question) => (p.confirm ? p.confirm(question) : window.confirm(question));
	// The first reading of the settings again, after it failed (v0.2 offers it).
	let loadTry = $state(0);
	const loadAgain = () => {
		error = '';
		loadTry++;
	};
	const x = $derived(tNow.current.setup);

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
		loadTry;
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
		if (role === 'primary' && !(await ask(tr().setup.role.confirm))) {
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
		const catalog = await creditsCatalog().catch(() => null);
		const offered = catalog?.network;
		if (offered === null) throw new Error(tr().setup.backups.notPaying);
		if (offered && offered !== want) throw new Error(tr().setup.backups.errors.payOtherNetwork(netName(offered), netName(want)));
		// A host with its own dialog (v0.2) asks before the balance is charged, with the price where the service names it.
		if (p.confirm && !(await p.confirm(tr().v2.system.payMonthConfirm(catalog?.backup?.monthCents != null ? format.euro(catalog.backup.monthCents) : '')))) return;
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
		if (profile.ageIdentity && profile.ageIdentity !== vaultAge && !(await ask(tr().setup.backups.errors.replaceAge))) return;
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
	const affordableKey = $derived(`${packagePays}|${profile?.appPays ? 'app' : profile?.leSpacePays ? 'lespace' : 'wallet'}|${profile?.payer ?? ''}|${balancesRoundNow.current}`);
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
							e instanceof TypeError ? tNow.current.ownImage.choice.creditsUnreachable
							: e instanceof CreditsShortError ? tNow.current.ownImage.choice.packageShort(e.price != null ? format.euro(e.price, langNow.current) : null, e.neededCredits != null ? format.euro(e.neededCredits, langNow.current) : null)
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
				confirm: (question) => ask(question),
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
	const day = (/** @type {string | number} */ at) => format.date(at, {}, langNow.current);
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

	return {
		loadAgain,
		// Written by the markup only: the person picked an image kind themselves.
		set imageKindPicked(v) { imageKindPicked = v; },
		get x() { return x; },
		pwaAddress,
		sessionAddress,
		backupKey,
		get backupState() { return backupState; },
		set backupState(v) { backupState = v; },
		get profile() { return profile; },
		set profile(v) { profile = v; },
		get loaded() { return loaded; },
		set loaded(v) { loaded = v; },
		get alephOk() { return alephOk; },
		set alephOk(v) { alephOk = v; },
		get sessionUntil() { return sessionUntil; },
		set sessionUntil(v) { sessionUntil = v; },
		get relayInput() { return relayInput; },
		set relayInput(v) { relayInput = v; },
		get foundRelays() { return foundRelays; },
		set foundRelays(v) { foundRelays = v; },
		get ageInput() { return ageInput; },
		set ageInput(v) { ageInput = v; },
		get imageInput() { return imageInput; },
		set imageInput(v) { imageInput = v; },
		get ownerInput() { return ownerInput; },
		set ownerInput(v) { ownerInput = v; },
		get passInput() { return passInput; },
		set passInput(v) { passInput = v; },
		get crnInput() { return crnInput; },
		set crnInput(v) { crnInput = v; },
		get dnsInput() { return dnsInput; },
		set dnsInput(v) { dnsInput = v; },
		get error() { return error; },
		set error(v) { error = v; },
		get busy() { return busy; },
		set busy(v) { busy = v; },
		get errorKey() { return errorKey; },
		set errorKey(v) { errorKey = v; },
		get savedKey() { return savedKey; },
		set savedKey(v) { savedKey = v; },
		connect,
		changeNetwork,
		setPays,
		setRole,
		authorize,
		session,
		setBackupsByCredits,
		payBackups,
		authorizeBackupKey,
		saveRelay,
		saveAge,
		get vaultAge() { return vaultAge; },
		useVaultAge,
		toggleBackups,
		get placesPending() { return placesPending; },
		set placesPending(v) { placesPending = v; },
		savePlaces,
		pushPlaces,
		get recipient() { return recipient; },
		saveOwner,
		saveImage,
		get ownStep() { return ownStep; },
		set ownStep(v) { ownStep = v; },
		get imageKind() { return imageKind; },
		set imageKind(v) { imageKind = v; },
		get publicImage() { return publicImage; },
		get affordable() { return affordable; },
		set affordable(v) { affordable = v; },
		get ownBuilt() { return ownBuilt; },
		choosePublic,
		buildImage,
		removeOldImages,
		saveDns,
		get showAleph() { return showAleph; },
		get showFilecoin() { return showFilecoin; },
		get devSteps() { return devSteps; },
		get step() { return step; },
		titled,
		get backupCoins() { return backupCoins; },
		fundedUntil,
		until,
		get o() { return o; },
		get status() { return status; },
		get opened() { return opened; },
		set opened(v) { opened = v; },
		goTo,
		get devOpen() { return devOpen; },
		set devOpen(v) { devOpen = v; },
	};
}
