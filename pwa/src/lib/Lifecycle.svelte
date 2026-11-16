<script>
	import { fallbackPatch, forgetQueued, forgettable, releasePrevious, startWentWell } from '$lib/old-image.js';
	import { forgetOldImage } from '$lib/own-image-build.js';
	import { ownImagePatch } from '$lib/own-image-check.js';
	import { balancesRound, onceThisRound } from '$lib/balance-refresh.js';
	import RefreshBalances from '$lib/RefreshBalances.svelte';
	import { backupListing, loadProfile, updateProfile } from '$lib/profile.js';
	import { noteError, noteState } from '$lib/diagnosis.js';
	import { AlephShortError, BackupPartialError, StartGoneError, pushBackupPlaces, attestRunning, confirmPeriodEndBackup, confirmStopBackup, eraseStopped, syncPeriodEnd, noteVaultBackups, resumeAfterPartial, resumeStart, retryBackupRevoke, startPaperless, startRequirements, stopPaperless, pickNode, buildsImageFirst } from '$lib/lifecycle.js';
	import { buildImageForVault } from '$lib/own-image-build.js';
	import { BUILDER, hasOwnImage, imageStatus } from '$lib/own-image.js';
	import FirstStart from '$lib/FirstStart.svelte';
	import { onImageBuild } from '$lib/image-build-request.js';
	import { fetchPercent, stationOfBuildStep } from '$lib/first-start.js';
	import { vmStatus } from '$lib/vm.js';
	import { stoppedAtPeriodEnd } from '$lib/period-end.js';
	import Storage from '$lib/Storage.svelte';
	import { statusToken } from '$lib/keys/derive.js';
	import { CREDITS_URL, creditsBalance, fundVm, quoteVm, vmAuthorize } from '$lib/credits.js';
	import { hourPurchase, purchaseLocked } from '$lib/purchase.js';
	import HourQuote from '$lib/HourQuote.svelte';
	import { amount } from '$lib/balances.js';
	import { isAuthorized, readAuthorizations } from '$lib/permissions.js';
	import { alephBalance } from '$lib/balances.js';
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import BackupExport from '$lib/BackupExport.svelte';
	import { checkCopies } from '$lib/backup-status.js';
	import { listProviders } from '$lib/providers.js';
	import { replacementPlan } from '$lib/places-replace.js';
	import { blockedAmong, blockedReason } from '$lib/blocked-providers.js';
	import { backupSize, knownBackup, listBackups, newerBackup, pieceCidOfStop, place, restoreEntry, restoreGap, splitOwn } from '$lib/backups.js';
	import { paperlessSecrets } from '$lib/keys/derive.js';
	import { startingInstance } from '$lib/starting.js';
	import BackupNow from '$lib/BackupNow.svelte';
	import TrialRestore from '$lib/TrialRestore.svelte';
	import ProviderHealth from '$lib/ProviderHealth.svelte';
	import BackupChain from '$lib/BackupChain.svelte';
	import { providerIdsIn } from '$lib/providers.js';
	import Evidence from '$lib/Evidence.svelte';
	import { evidenceRows } from '$lib/evidence.js';
	import { evidenceTexts, panelTexts } from '$lib/evidence-i18n.js';
	import { format, lang as appLanguage, t as i18n, tr } from '$lib/i18n/index.js';
	import StartPanel from '$lib/StartPanel.svelte';
	import { panelTimes, startPanel } from '$lib/start-panel.js';
	import { stopPanel } from '$lib/stop-panel.js';
	import { httpsUrl, stopEvidenceRows } from '$lib/evidence.js';
	import { checkBackupHeader } from '$lib/backup-header.js';
	import { ageIdentityFromMaster, ageRecipient } from '$lib/keys/age.js';
	import { RUNTIME } from '$lib/runtime-pin.js';
	import { ALEPH_API } from '$lib/aleph.js';
	import { isNetworkError, preloadAttestWasm } from '$lib/attest-wasm-load.js';

	/** @type {{ master: Uint8Array, simple?: boolean, version?: number, onchange?: () => void, onadvanced?: () => void, onmissing?: (missing: string[]) => void, onglance?: (g: Glance) => void, onbusy?: (busy: boolean) => void, oncopies?: (c: { network: string, copies: { providerId: number, url?: string }[] }) => void, reach?: import('$lib/backup-status.js').Level }} reach: the "Sicherungen erreichbar" light; oncopies: the newest backup's copies, for the lights */
	let { master, simple = false, version = 0, onchange = () => {}, onadvanced = () => {}, onmissing = () => {}, onglance = () => {}, onbusy = () => {}, oncopies = () => {}, reach = 'unknown' } = $props();
	/** @typedef {{ phase: string, host: string | null, lastGood: { at: string, copies: number | null } | null, backupsOn: boolean, pays: 'lespace' | 'app' | 'wallet' | null, fixedHost: boolean }} Glance */

	/** @type {Record<string, any>} */
	let profile = $state({});
	let progress = $state('');
	// The full-screen first start with an own image (FirstStart.svelte), or its certificate opened later.
	/** @type {{ station: string, since: number, fetchPct: number | null, done: boolean, failed: boolean, minimized: boolean, certificate: boolean, only: boolean, rebuild?: boolean, facts?: import('$lib/first-start.js').Facts } | null} */
	let ceremony = $state(null);
	const showCertificate = () => (ceremony = { station: 'paperless', since: Date.now(), fetchPct: null, done: true, failed: false, minimized: false, certificate: true, only: true });
	// The steps of a start and a stop, with what they took in our runs so far.
	// Start, live on mainnet 2026-11-11 (1 GB backup restored): measure 9-14 s,
	// placing 108 s, port 23 s, attestation and unlock 199 s, then Paperless
	// and the restore. The live tests of 2026-10-22 took 336-399 s in all
	// without a restore; a restore of about 1 GB adds about 5 min.
	const STEPS = {
		start: [
			{ step: 'measure', typical: 10 },
			{ step: 'instance', typical: 90 },
			{ step: 'network', typical: 25 },
			{ step: 'unlock', typical: 180 },
			{ step: 'ready', typical: 300, typicalWithRestore: 600 }
		],
		stop: [
			// With backups on, the stop waits for one: export, encryption, upload
			// to two providers and their confirmation on chain (about 6-8 min,
			// mostly fixed costs). Erasing waits for the node to confirm.
			{ step: 'stop', typical: 10, typicalWithBackup: 540 },
			{ step: 'forget', typical: 60 }
		],
		// "Löschen ohne Sicherung" after a failed restore: erasing only.
		discard: [{ step: 'forget', typical: 60 }]
	};
	/** @type {'start' | 'stop' | 'discard' | ''} */
	let action = $state('');
	/** @type {Record<string, { from: number, to?: number }>} */
	let times = $state({});
	let current = $state('');
	let startedAt = $state(0);
	// What the start panel's lights are lit from: the library's phase within
	// the unlock, what the unlock returned, the VM's status page, and whether
	// this start restores a backup.
	let libPhase = $state('');
	/** @type {{ already?: boolean, injected?: string[], attestation?: any } | null} */
	let unlockSeen = $state(null);
	/** @type {any} */
	let vmPage = $state(null);
	let startRestores = $state(false);
	// What a stop or an erase panel is lit from, besides the status page: the
	// request sent, the backup's log lines seen so far, what the node, Aleph
	// and Le Space's service answered, and whether the backup went into the list.
	let stopSent = $state(false);
	/** @type {string[]} */
	let vmLines = $state([]);
	/** @type {{ node?: string | null, forgot?: string, revoke?: string } | null} */
	let eraseSeen = $state(null);
	/** @type {boolean | null} */
	let listedSeen = $state(null);
	/** @type {'checking' | 'opens' | 'refused' | 'unreachable' | null} the app's check of the backup's age header */
	let headerSeen = $state(null);
	/** @type {{ status: any, erase: typeof eraseSeen, instanceHash: string, recipient: string | null, fromVault: boolean } | null} the last stop's facts, for its evidence */
	let stopDone = $state(null);
	let now = $state(Date.now());
	let ticker = 0;
	const track = (/** @type {'start' | 'stop' | 'discard'} */ kind) => {
		action = kind;
		times = {};
		libPhase = '';
		unlockSeen = null;
		vmPage = null;
		current = '';
		stopSent = false;
		vmLines = [];
		eraseSeen = null;
		listedSeen = null;
		headerSeen = null;
		stopDone = null;
		startedAt = Date.now();
		clearInterval(ticker);
		ticker = setInterval(() => (now = Date.now()), 1000);
		return (/** @type {{ step: string, detail?: string, status?: any, instanceHash?: string, phase?: string, already?: boolean, injected?: string[], attestation?: any, sent?: boolean, erase?: any }} */ { step, detail, status, instanceHash, phase, already, injected, attestation, sent, erase }) => {
			progress = detail ?? step;
			if (sent) stopSent = true;
			if (erase) eraseSeen = erase;
			// The status page shows the backup's last three lines only: keep all seen.
			const lines = status?.backup?.log;
			if (Array.isArray(lines)) vmLines = [...vmLines, ...lines.filter((l) => !vmLines.includes(l))].slice(-200);
			if (step === 'unlock' && phase) libPhase = phase;
			if (already) unlockSeen = { already: true };
			if (injected) unlockSeen = { injected, attestation };
			if (status) vmPage = status;
			if (instanceHash) startingInstance.set(instanceHash);
			if (step !== current) {
				if (current && times[current]) times[current].to = Date.now();
				times[step] = { from: Date.now() };
				current = step;
			}
		};
	};
	// A start that restores a backup takes longer in its last step.
	const typicalOf = (s) =>
		profile.backupConfig && s.typicalWithBackup ? s.typicalWithBackup : choice !== 'empty' && s.typicalWithRestore ? s.typicalWithRestore : s.typical;
	const seconds = (ms) => `${Math.max(0, Math.round(ms / 1000))} s`;
	const minutes = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);
	let error = $state('');
	// An interrupted start Aleph no longer had: dropped, and why (not an error).
	let goneNote = $state('');
	// A broken connection: a plain sentence above, the browser's own words
	// under "Details", and what "Noch einmal" does (null: nothing to repeat).
	let errorRaw = $state('');
	// The attest WASM (2.4 MB, several seconds from the gateway) is fetched
	// while the card is read, so a start does not wait for it.
	$effect(() => {
		const id = setTimeout(() => preloadAttestWasm(), 2000);
		return () => clearTimeout(id);
	});
	/** @type {(() => unknown) | null} */
	let again = $state(null);
	/** @type {string[]} the VM's backup log lines when a backup failed */
	let errorLog = $state([]);
	// The providers the VM named in its lines, and the ones the backups go to.
	// The last backup that reached providers, kept in the profile so it shows
	// while Paperless is off and on images that do not report it.
	const STALE_HOURS = 4;
	let nowTick = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (nowTick = Date.now()), 60_000);
		return () => clearInterval(t);
	});
	// Profiles from before this keep the last stop's backup.
	// A profile from before keeps only the last stop's backup: said as such.
	const fromStop = $derived(!profile.lastGoodBackup?.at && Boolean(profile.lastBackup?.date));
	const lastGood = $derived(profile.lastGoodBackup?.at ? profile.lastGoodBackup : profile.lastBackup?.date ? { at: profile.lastBackup.date, copies: profile.lastBackup.copies?.length ?? null, pieceCid: profile.lastBackup.pieceCid ?? null } : null);
	// Older images do not report their two-hourly backups; the chain lists
	// them (without a time). A newer piece than the one known here is said so.
	const newerOnChain = $derived(Boolean(lastGood?.pieceCid && backups?.length && backups[0].pieceCid !== lastGood.pieceCid));
	const goodStale = $derived(Boolean(lastGood && profile.running && !newerOnChain && nowTick - new Date(lastGood.at).getTime() > STALE_HOURS * 3600_000));
	const ago = (/** @type {number} */ ms) => {
		const minutes = Math.floor(ms / 60_000);
		const a = c.ago;
		if (minutes < 60) return minutes <= 1 ? a.now : a.minutes(minutes);
		const hours = Math.floor(minutes / 60);
		if (hours < 48) return a.hours(hours);
		return a.days(Math.floor(hours / 24));
	};
	const goodWhen = (/** @type {string} */ at) => {
		const d = new Date(at);
		const time = format.dateTime(d, d.toDateString() === new Date(nowTick).toDateString() ? { hour: '2-digit', minute: '2-digit' } : { dateStyle: 'medium', timeStyle: 'short' }, $appLanguage);
		return `${time} (${ago(nowTick - d.getTime())})`;
	};
	/** A backup that reached providers: remember it if newer. @param {{ at: string, copies?: number, requested?: number }} good */
	async function rememberGood(good) {
		if (!good?.at || (profile.lastGoodBackup?.at && new Date(profile.lastGoodBackup.at) >= new Date(good.at))) return;
		profile = await updateProfile(master, (now) =>
			now.lastGoodBackup?.at && new Date(now.lastGoodBackup.at) >= new Date(good.at) ? now : { ...now, lastGoodBackup: { at: good.at, copies: good.copies ?? null, requested: good.requested ?? null } }
		);
	}
	// The evidence of the running VM: what the app checked, what was only reported.
	// Both follow the language switch in the header.
	const evidenceT = $derived(evidenceTexts[$appLanguage]);
	const evidence = $derived(
		profile.running ? evidenceRows({ running: profile.running, rootfsItemHash: profile.rootfsItemHash, runtime: RUNTIME, alephApi: ALEPH_API, lastGood, backupsOn: Boolean(profile.backupConfig), ownImage: Boolean(BUILDER && hasOwnImage(profile, BUILDER.plain.sha256)) }) : []
	);
	const panelT = $derived(panelTexts[$appLanguage]);
	const startShown = $derived(action === 'start' && (busy || Object.keys(times).length > 0));
	const stopShown = $derived((action === 'stop' || action === 'discard') && (busy || Object.keys(times).length > 0));
	const panel = $derived(
		startShown ? startPanel({ step: current, libPhase, unlock: unlockSeen, status: vmPage, restore: startRestores, finished: !busy && Boolean(profile.running), failed: !busy && !profile.running && Boolean(error) })
		: stopShown ? stopPanel({ kind: action === 'discard' ? 'discard' : 'stop', sent: stopSent, status: vmPage, lines: vmLines, erase: eraseSeen, listed: listedSeen, header: headerSeen, busy, finished: !busy && !profile.running && !error, failed: !busy && Boolean(error) })
		: []
	);
	// The stop's texts: the start's states and legend, its own rows and lights.
	const panelShownT = $derived(
		stopShown ? { ...panelT, ...panelT.stop, ...(action === 'discard' ? { title: panelT.stop.titleDiscard, after: panelT.stop.afterDiscard } : {}) } : panelT
	);
	// After a stop: where the backup went and how the VM was forgotten.
	const stopEvidence = $derived(stopDone && !busy ? stopEvidenceRows({ ...stopDone, header: headerSeen, alephApi: ALEPH_API, docsLang: $appLanguage }) : []);
	const checkAgain = async () => {
		await attestRunning(master, $state.snapshot(profile));
		profile = await loadProfile(master);
	};
	const healthIds = $derived([...new Set([...providerIdsIn(errorLog), ...(profile.backupConfig?.providerIds ?? [])])]);
	// A stop whose backup reached fewer providers than requested: Paperless is
	// paused and the VM waits for the person to erase it anyway or keep it.
	/** @type {BackupPartialError | null} */
	let partial = $state(null);
	let busy = $state(false);
	// The page asks before it is left while a start, a backup or a stop is under way.
	$effect(() => onbusy(busy));
	// A backup requested from the overview runs: no stop meanwhile.
	let backingUp = $state(false);
	/** @type {any[] | null} */
	let backups = $state(null);
	let backupsError = $state('');
	// Only this vault's own backups are offered by default: the test data sets
	// also hold backups encrypted to other keys (round trips), which this vault
	// cannot decrypt (live: "age could not decrypt the piece").
	let choice = $state('empty');
	// "Own" are the backups that carry this vault's mark (vaultBackups, checked
	// by the app); any other one is offered only as such, and only after the
	// person confirms it (unmarkedAccepted): older backups and anything not made by
	// this vault's Paperless.
	const split = $derived(splitOwn(backups ?? [], profile.vaultBackups ?? []));
	// The piece the person confirmed: another backup asks again.
	let unmarkedAccepted = $state('');
	// The newest one: a backup counts once it reached at least one provider
	// (the restore checks the piece itself); "complete" only compared the copies
	// with every data set the wallet ever used, and a backup that went to a
	// replacement provider never looked complete (2026-11-06).
	const pick = (list) => list[0];
	// A production Paperless (role primary, mainnet) owns every backup in its
	// wallet's data sets: the ones its stops made, and the two-hourly ones the
	// app never hears of. It starts from the newest, whoever made it. A test
	// keeps to this vault's own (the test data sets hold other keys' backups).
	const production = $derived(profile.role === 'primary' && profile.network === 'mainnet');
	// Without a marked one: the newest unmarked one this vault's stops made
	// (older than the mark), or for a production Paperless the newest of all;
	// either one only after the person confirms it.
	const unmarkedPick = (/** @type {any[]} */ other) => (production ? pick(other) : (pick(other.filter((b) => (profile.ownBackups ?? []).includes(b.pieceCid))) ?? pick(other)));
	const defaultChoice = (/** @type {any[]} */ list) => {
		const { own, other } = splitOwn(list, profile.vaultBackups ?? []);
		if (own.length) return production ? 'latest' : 'own';
		return (production ? other.length : other.some((b) => (profile.ownBackups ?? []).includes(b.pieceCid))) ? 'any' : 'empty';
	};
	// "Latest" is the newest backup with this vault's mark: only those start without asking.
	const chosenBackup = $derived(choice === 'latest' || choice === 'own' ? pick(split.own) : choice === 'any' ? unmarkedPick(split.other) : null);
	// A backup without this vault's mark waits for the person's word.
	const unmarkedOpen = $derived(choice === 'any' && Boolean(chosenBackup) && unmarkedAccepted !== chosenBackup?.pieceCid);
	// The newest backup, for the lights at the top: this vault's own, else the newest listed.
	const newestBackup = $derived(pick(split.own) ?? pick(backups ?? []) ?? null);
	$effect(() => {
		if (backups === null || backupsError) return;
		oncopies({ network: profile.network ?? 'calibration', copies: (newestBackup?.copies ?? []).map((/** @type {any} */ x) => ({ providerId: Number(x.providerId), url: x.retrievalUrl })) });
	});
	// The backup whose copies the chain check shows: the one chosen, else this vault's newest, else the newest.
	const chainBackup = $derived(chosenBackup ?? pick(split.own) ?? pick(backups ?? []) ?? null);
	// The chain's answer against what the sealed profile knows: a start that
	// would go back behind the last known backup (the list lacks it, or the
	// choice is older) waits for the person to say so.
	const known = $derived(knownBackup(profile));
	const gap = $derived(backups && !backupsError ? restoreGap(backups, chosenBackup, known) : null);
	const gapKey = $derived(`${gap}:${choice}:${chosenBackup?.pieceCid ?? ''}`);
	let gapAccepted = $state('');
	const gapOpen = $derived(Boolean(gap) && gapAccepted !== gapKey);
	// The date of a backup, where the profile knows it (the chain has none).
	const whenOf = (b) => (b && lastGood?.pieceCid === b.pieceCid && lastGood.at ? c.dated(format.dateTime(lastGood.at, undefined, $appLanguage)) : '');
	const wherePlaces = (b) => b.copies.map((c) => c.place || tr().card.provider(c.providerId)).join(tr().card.and);
	// Size, and the parts a large backup went up in: shown as one backup.
	const sizeOf = (b) => [backupSize(b.size), b.parts?.length > 1 ? c.inParts(b.parts.length) : ''].filter(Boolean).join(' ');
	const sizePart = (b) => (sizeOf(b) ? `, ${sizeOf(b)}` : '');
	// The admin password is derived from the master secret; it is shown only on request.
	let showPassword = $state(false);
	const adminPassword = $derived(paperlessSecrets(master).adminPassword);
	const copyPassword = () => navigator.clipboard?.writeText(adminPassword);

	let loaded = $state(false);
	/** A revoke of the backup key retried in the background; a start waits for it. */
	let revoking = Promise.resolve();
	// Through Le Space Credits, the service lists this account's data sets;
	// without its answer, the payer's are filtered by label and tag alone.
	const listingNow = async () => backupListing(profile, profile.backupsByCredits && profile.backupSigner ? ((await creditsBalance(master).catch(() => null))?.backup ?? null) : null);
	const reload = async () => {
		profile = await loadProfile(master);
		// An own image built before its record named its STORE: completed once
		// the passphrase proves it, so the start knows it (own-image-check.js).
		const ownPatch = ownImagePatch(master, profile);
		if (ownPatch) profile = await updateProfile(master, (now) => ({ ...now, ...ownPatch }));
		loaded = true;
		// Old own images whose FORGET failed earlier: tried again.
		if (!busy) forgetOldImages();
		// A revoke that failed when the VM was deleted, as long as no VM uses the key.
		if (profile.backupRevokePending && !busy) revoking = retryBackupRevoke(master, $state.snapshot(profile)).then(() => {}, () => {});
		// A stop that ended partial while this page was closed still waits.
		if (profile.running)
			vmStatus(profile.running.host, statusToken(master))
				.then(async (s) => {
					if (s?.phase === 'stop-partial' && !busy && !partial) partial = new BackupPartialError(s);
					// The VM stopped itself at the end of the paid time, with its
					// last backup: erased now, once that backup is on the chain.
					// A running one hears a changed end (a new voucher, a renewal).
					if (stoppedAtPeriodEnd(s)) {
						if (!busy && !periodEndTried) {
							periodEndTried = true;
							eraseAtPeriodEnd(s);
						}
					} else if (!busy && !syncingEnd) {
						syncingEnd = true;
						syncPeriodEnd(master, $state.snapshot(profile), s).catch(() => {}).finally(() => (syncingEnd = false));
					}
					// The backups this VM made with this vault's mark, also the two-hourly ones.
					const noted = await noteVaultBackups(master, $state.snapshot(profile), s);
					if (noted) profile = noted;
				})
				.catch(() => {});
		const listing = await listingNow();
		if (listing && profile.ageIdentity) {
			backupsError = '';
			listBackups({ network: profile.network ?? 'calibration', ...listing })
				.then((list) => ((backups = list), (choice = defaultChoice(list))))
				.catch(() => ((backups = []), (backupsError = tr().card.backupsUnreadable)));
		}
	};
	// Again whenever the setup saved something (`version` changes).
	$effect(() => {
		version;
		reload().catch((e) => (error = e.message));
	});

	// Aleph would refuse a start for lack of reserve: how much, so the app can
	// offer to buy hours from Le Space Credits (when the app pays itself).
	/** @type {AlephShortError | null} */
	let short = $state(null);
	let fundHours = $state(10);
	// Usable hours in the package (on the Le Space sub-account). When the
	// app's own address is short but the package holds hours, the start is
	// offered from the package instead of a purchase.
	/** @type {number | null} */
	let packageHours = $state(null);
	$effect(() => {
		$balancesRound;
		if (!(short && CREDITS_URL && profile.appPays && !profile.leSpacePays)) return;
		onceThisRound('credits-balance', () => creditsBalance(master))
			.then((b) => (packageHours = b?.plan?.hoursLeft == null ? null : Math.floor(b.plan.hoursLeft)))
			.catch(() => (packageHours = null));
	});
	const fromPackage = $derived(Boolean(short && CREDITS_URL && profile.appPays && !profile.leSpacePays && packageHours != null && packageHours >= 1));
	// Le Space pays the VM from the package from now on (model A), then start.
	const startFromPackage = () => run(async () => {
		progress = tr().card.progress.packagePays;
		profile = await updateProfile(master, (now) => ({ ...now, appPays: false, leSpacePays: true }));
		onchange();
		await startNow();
	});
	// The confirmation before hours are bought: quote first, then one purchase.
	/** @type {import('$lib/purchase.js').PurchaseState} */
	let buying = $state({ phase: 'idle', hours: null, quote: null, error: '' });
	let bought = $state('');
	const purchase = hourPurchase({
		quote: (hours) => quoteVm(master, hours),
		buy: (hours, quote) => fundAndStart(hours, quote),
		onchange: (s) => (buying = s)
	});
	const askToBuy = () => {
		bought = '';
		purchase.ask(fundHours);
	};
	/** @param {() => Promise<unknown>} fn @param {(() => unknown) | null} [retry] what "Noch einmal" does after a broken connection */
	async function run(fn, retry = null) {
		// Another action closes an open confirmation; it buys nothing.
		purchase.cancel();
		error = '';
		errorRaw = '';
		goneNote = '';
		again = null;
		errorLog = [];
		short = null;
		partial = null;
		busy = true;
		try {
			await fn();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			if (isNetworkError(e)) {
				errorRaw = error;
				error = tr().net.broken;
				again = retry;
			} else if (/** @type {any} */ (e)?.retryable) again = retry;
			errorLog = [.../** @type {any} */ ((e)?.facts ?? []), .../** @type {any} */ ((e)?.log ?? [])];
			// For "Diagnose kopieren": the browser's own words where there are any, and the step.
			noteError({ action, step: progress, message: errorRaw || error });
			if (e instanceof AlephShortError) short = e;
			if (e instanceof BackupPartialError) {
				partial = e;
				error = '';
			}
		} finally {
			busy = false;
			progress = '';
			clearInterval(ticker);
			if (current && times[current] && !times[current].to) times[current].to = Date.now();
		}
	}

	// A package pays the VM, but the service says no backup period covers today
	// (Le-Space/paperless-anywhere#175): the start asks once instead of running
	// on without backups. A test instance is not asked, and neither is someone
	// whose backups are paid from their own wallet.
	let unpaidBackup = $state(false);
	async function backupUnpaid() {
		if (!CREDITS_URL || !profile.leSpacePays || profile.role !== 'primary') return false;
		if (profile.backupConfig && !profile.backupsByCredits) return false;
		return (await creditsBalance(master).catch(() => null))?.backup?.active === false;
	}
	let asking = false;
	const start = async () => {
		if (asking) return;
		asking = true;
		try {
			unpaidBackup = await backupUnpaid();
		} finally {
			asking = false;
		}
		if (!unpaidBackup) run(startNow, startAgain);
	};
	const startWithoutBackup = () => {
		unpaidBackup = false;
		run(startNow, startAgain);
	};
	// Again after a broken connection: a start Aleph may already have carries
	// on (resume), so a second click never asks for a second VM.
	const startAgain = () => (profile.running ? undefined : profile.starting ? resume() : start());
	const toPackage = () => {
		unpaidBackup = false;
		document.getElementById('paket')?.scrollIntoView({ behavior: 'smooth' });
	};
	/**
	 * Model A: ask Le Space Credits for this app's delegation on the account
	 * that pays the VM, keep that account in the profile, and wait until Aleph
	 * shows the delegation (an INSTANCE before that would be refused).
	 */
	async function leSpaceOwner() {
		progress = tr().card.progress.authorize;
		const a = await vmAuthorize(master);
		if (profile.vmOwner !== a.owner) profile = await updateProfile(master, (now) => ({ ...now, vmOwner: a.owner }));
		const app = privateKeyToAccount(alephPrivateKey(master)).address;
		for (let i = 0; i < 30; i++) {
			if (isAuthorized(await readAuthorizations(a.owner).catch(() => []), app)) return a.owner;
			await new Promise((r) => setTimeout(r, 4000));
		}
		throw new Error(tr().card.errors.noDelegation);
	}
	async function startNow() {
		// A retried revoke first: the start authorizes the key again after it.
		await revoking;
		await reload();
		await revoking;
		if (profile.leSpacePays) await leSpaceOwner();
		const chosen = chosenBackup;
		const unmarked = choice === 'any';
		if (gapOpen) throw new Error(tr().card.errors.gapOpen);
		if (unmarkedOpen) throw new Error(tr().card.errors.unmarkedOpen);
		// No image yet: this vault's own one first (about 15 minutes; the page stays open),
		// shown as the full-screen first start (FirstStart.svelte).
		const first = buildsImageFirst(profile, BUILDER);
		try {
			await startNowInner(chosen, first, unmarked);
		} catch (e) {
			if (ceremony) ceremony = { ...ceremony, failed: true, minimized: false };
			throw e;
		}
	}
	/**
	 * Builds this vault's own image, shown in the full screen (FirstStart.svelte):
	 * at a first start, or again for a newer image version (`rebuild`, no start
	 * after it). Resolves false when the person declined the price.
	 * @param {boolean} rebuild
	 */
	async function buildWithJourney(rebuild) {
		progress = tr().card.progress.buildImage;
		const save = async (/** @type {Record<string, any>} */ patch) => {
			profile = await updateProfile(master, (now) => ({ ...now, ...patch }));
			onchange();
			// The builder's V-PROGRAM, once Aleph took it: a piece of evidence.
			if (ceremony && patch.ownBuilder?.vprogram) ceremony = { ...ceremony, facts: { ...ceremony.facts, vprogram: patch.ownBuilder.vprogram } };
		};
		const built = await buildImageForVault({
			master,
			profile: $state.snapshot(profile),
			packagePays: Boolean(profile.leSpacePays),
			confirm: (question) => window.confirm(question),
			save,
			onProgress: (/** @type {{ step: string, detail?: string, data?: Record<string, any> }} */ { step, detail, data }) => {
				progress = `${tr().card.progress.buildImage}: ${detail ?? step}`;
				const station = stationOfBuildStep(step);
				if (!station) return;
				const pct = station === 'fetch' ? (data?.size ? Math.floor((Number(data.got ?? 0) / Number(data.size)) * 100) : fetchPercent(detail)) : null;
				// The first sign of the build opens the full screen (after a price was agreed).
				if (!ceremony) ceremony = { station, since: Date.now(), fetchPct: pct, done: false, failed: false, minimized: false, certificate: false, only: false, rebuild, facts: { node: BUILDER?.crn } };
				else if (ceremony.station !== station) ceremony = { ...ceremony, station, since: Date.now(), fetchPct: pct };
				else if (pct != null) ceremony = { ...ceremony, fetchPct: pct };
				// What the build reports on the way (own-image.js), and when the fetch began, for its speed.
				const facts = { ...ceremony.facts, ...(data ?? {}) };
				if (station === 'fetch' && !facts.fetchSince) facts.fetchSince = Date.now();
				ceremony = { ...ceremony, facts };
			}
		});
		if (!built) {
			progress = '';
			return false;
		}
		await save(built);
		return true;
	}
	// A newer image version: built again while Paperless is off, without a start after it.
	async function rebuildFlow() {
		if (profile.running || profile.starting) throw new Error(tr().first.whileRunning);
		try {
			if (!(await buildWithJourney(true))) return false;
			progress = '';
			if (ceremony) ceremony = { ...ceremony, done: true, minimized: false };
			return true;
		} catch (e) {
			if (ceremony) ceremony = { ...ceremony, failed: true, minimized: false };
			throw e;
		}
	}
	const rebuildImage = () => run(rebuildFlow);
	// "Mein Image bauen" in the setup comes here too (image-build-request.js),
	// so every build shows the same full screen.
	$effect(() =>
		onImageBuild(() => {
			if (busy) return Promise.reject(new Error(tr().first.busy));
			return new Promise((resolve, reject) => {
				run(async () => {
					try {
						resolve(await rebuildFlow());
					} catch (e) {
						reject(e);
						throw e;
					}
				});
			});
		})
	);
	/** @param {any} chosen @param {boolean} first @param {boolean} [unmarked] the person confirmed a backup without the vault's mark */
	async function startNowInner(chosen, first, unmarked = false) {
		if (first) {
			if (!(await buildWithJourney(false))) return;
			if (ceremony) ceremony = { ...ceremony, station: 'paperless', since: Date.now(), fetchPct: null };
		}
		// No node fixed in the setup: one with room now.
		if (!profile.crnHash) progress = tr().card.progress.pickNode;
		const crnHash = profile.crnHash || (await pickNode());
		const forStart = { ...$state.snapshot(profile), crnHash, restoreEntry: chosen ? { ...restoreEntry(chosen), ...(unmarked ? { unmarked: true } : {}) } : null };
		startRestores = Boolean(forStart.restoreEntry);
		// Once Aleph has the VM, the profile knows it: a reload carries on from there.
		const onRequested = async (starting) => {
			profile = await updateProfile(master, (now) => ({ ...now, starting }));
			onchange();
		};
		// The start's steps feed the full screen too: the VM's INSTANCE, its step, its attestation.
		const tracked = track('start');
		const step = (/** @type {any} */ p) => {
			tracked(p);
			if (!ceremony) return;
			const facts = { ...ceremony.facts };
			if (p.instanceHash) facts.instanceHash = p.instanceHash;
			if (p.step) facts.vmStep = p.step;
			if (p.attestation?.measurement) facts.vmMeasurement = p.attestation.measurement;
			ceremony = { ...ceremony, facts };
		};
		await finishStart(() => startPaperless(master, forStart, step, { onRequested }));
		if (ceremony) ceremony = { ...ceremony, done: true, minimized: false };
	}
	// Buy hours from Le Space Credits: the service grants them (with Aleph's
	// start reserve) to the account that pays the VM; once Aleph shows them,
	// start. Under model A the service grants to the customer's Le Space
	// sub-account, never to the app's own address: if the hours land there
	// while the app's address was to pay, the VM is paid from the package.
	// Only after the person confirmed the quote, and once per confirmation:
	// nothing here retries the purchase (see purchase.js).
	const fundAndStart = (/** @type {number} */ hours, /** @type {any} */ quote) => {
		// Read before run() clears `short`.
		const need = short?.reserve ?? 0;
		return run(async () => {
			progress = tr().card.progress.buyHours;
			const app = privateKeyToAccount(alephPrivateKey(master)).address;
			const before = profile.leSpacePays ? null : (await alephBalance(app).catch(() => null))?.credits ?? null;
			const funded = await fundVm(master, hours);
			// What the account holds now, from the service itself.
			const now = await creditsBalance(master).catch(() => null);
			bought = tr().card.bought({ hours, price: amount(funded.chargedCredits / 100), balance: now ? amount(now.credits / 100) : null, vmHours: quote?.hoursAfter != null ? amount(quote.hoursAfter, 1) : null });
			let payer = profile.leSpacePays ? (profile.vmOwner ?? app) : app;
			if (funded.to && funded.to.toLowerCase() !== app.toLowerCase()) payer = funded.to;
			progress = tr().card.progress.waitCredit;
			const enough = (/** @type {number} */ c) => c >= need && (before == null || payer !== app || c > before);
			for (let i = 0; i < 36; i++) {
				const b = await alephBalance(payer).catch(() => null);
				if (b && enough(b.credits)) break;
				// The app's address did not get them after half a minute: ask
				// the service whether it pays this customer's VMs from a
				// sub-account (model A) and look there.
				if (i === 6 && payer === app && !profile.leSpacePays) {
					const owner = await vmAuthorize(master).then((a) => a.owner).catch(() => null);
					if (owner) payer = owner;
				}
				if (i === 35) throw new Error(tr().card.errors.creditNotSeen);
				await new Promise((res) => setTimeout(res, 5000));
			}
			if (payer.toLowerCase() !== app.toLowerCase() && !profile.leSpacePays) {
				// The hours are on the sub-account: from now on Le Space pays the VM from the package.
				progress = tr().card.progress.packagePays;
				profile = await updateProfile(master, (now) => ({ ...now, appPays: false, leSpacePays: true, vmOwner: payer }));
			}
			onchange();
			await startNow();
		});
	};
	const resume = () => run(async () => {
		await reload();
		// The VM may have made backups since this start was requested (it ran on
		// while this page was closed). What it restores now is the newest one, not
		// the one chosen then; if the backups cannot be read, the start waits.
		const chosen = profile.starting?.restoreEntry;
		const listing = chosen && profile.ageIdentity ? await listingNow() : null;
		if (listing) {
			progress = tr().card.progress.lookBackups;
			const vault = profile.vaultBackups ?? [];
			const newer = newerBackup(await listBackups({ network: profile.network ?? 'calibration', ...listing }), chosen, (b) => vault.includes(b.pieceCid));
			if (newer) profile = await updateProfile(master, (now) => (now.starting ? { ...now, starting: { ...now.starting, restoreEntry: restoreEntry(newer) } } : now));
		}
		startRestores = Boolean(profile.starting?.restoreEntry);
		try {
			await finishStart(() => resumeStart(master, $state.snapshot(profile), track('start')));
		} catch (e) {
			// Aleph rejected or forgot it: dropped, said plainly, and a new start offered.
			if (!(e instanceof StartGoneError)) throw e;
			profile = await updateProfile(master, ({ starting, ...rest }) => rest);
			onchange();
			goneNote = e.message;
		}
	}, () => startAgain());
	/** @param {() => Promise<any>} bringUp */
	async function finishStart(bringUp) {
		try {
			const running = await bringUp();
			// Which image this VM runs, so it is never forgotten under it (old-image.js).
			profile = await updateProfile(master, ({ starting, ...rest }) => ({ ...rest, running: { ...running, rootfsItemHash: rest.rootfsItemHash } }));
			// The new own image started well: the one before it is no longer the way back.
			if (startWentWell(running)) {
				const release = releasePrevious(profile);
				if (release) profile = await updateProfile(master, (now) => ({ ...now, ...release }));
				forgetOldImages();
			}
		} finally {
			startingInstance.set('');
		}
		onchange();
	}
	// Forget the queued old own images; what fails stays queued for the next opening.
	let forgettingOld = false;
	async function forgetOldImages() {
		if (forgettingOld || !forgettable(profile).length) return;
		forgettingOld = true;
		try {
			const app = privateKeyToAccount(alephPrivateKey(master));
			const left = await forgetQueued($state.snapshot(profile), (store) => forgetOldImage(app, store));
			profile = await updateProfile(master, ({ oldOwnImages, ...rest }) => (left.length ? { ...rest, oldOwnImages: left } : rest));
			onchange();
		} catch {
			// Tried again at the next opening.
		} finally {
			forgettingOld = false;
		}
	}
	// A start with the new own image failed: start from the one before it instead.
	const startPrevious = () =>
		run(async () => {
			const back = fallbackPatch(profile);
			if (!back) return;
			profile = await updateProfile(master, (now) => ({ ...now, ...back }));
			onchange();
			await startNow();
		}, startAgain);
	// Give up on an interrupted start; the VM stays in the list below to remove.
	const discard = () => run(async () => {
		profile = await updateProfile(master, ({ starting, ...rest }) => rest);
		onchange();
	});
	// With backups on: the piece CIDs the chain lists for this vault, read by the
	// app itself. A stop erases the VM only once its backup is among them.
	const backupsOnChain = () =>
		profile.backupConfig
			? async () => {
					const listing = await listingNow();
					if (!listing) throw new Error(tr().card.backupsUnreadable);
					return (await listBackups({ network: profile.network ?? 'calibration', ...listing })).filter((b) => b.copies.length > 0).map((b) => b.pieceCid);
				}
			: null;
	const stopNow = () => run(async () => {
		await reload();
		await finishStop(await stopPaperless(master, $state.snapshot(profile), track('stop'), { onChain: backupsOnChain() }));
	}, () => stop());
	// Before "Sichern und beenden": do the providers the backup goes to answer?
	// The named ones, else those of the newest backup. If none does, the backup
	// cannot go up and the VM keeps running: said, and asked. Without the
	// registry's answer nothing is said.
	let stopChecking = $state(false);
	// The same before "Jetzt sichern" and "Sichern und beenden": a provider
	// that does not answer is said before anything is exported, with a
	// replacement at an independent operator; confirmed, the new places go to
	// the running VM (pushBackupPlaces), and the backup goes on.
	/** @type {{ names: string[], plan: Awaited<ReturnType<typeof replacementPlan>> | null, allDown: boolean, then: () => unknown, blocked?: { names: string[], why: string } } | null} */
	let placesAsk = $state(null);
	// The named places that Le Space blocked (blocked-providers.js), in words.
	const blockedOf = (/** @type {number[]} */ ids, /** @type {any[]} */ providers) => {
		const network = profile.network ?? 'calibration';
		const blocked = blockedAmong(network, ids);
		if (!blocked.length) return null;
		const whys = [...new Set(blocked.map((id) => blockedReason(network, id)))].map((k) => tr().backup.places.blockedWhy[/** @type {'fidl'} */ (k)]);
		return { ids: blocked, names: blocked.map((id) => `${id} ${providers.find((p) => p.id === id)?.name ?? ''}`.trim()), why: whys.join('; ') };
	};
	async function checkPlacesThen(/** @type {() => unknown} */ then) {
		const named = (profile.backupConfig?.providerIds ?? []).map(Number);
		const ids = named.length ? named : (newestBackup?.copies ?? []).map((/** @type {any} */ x) => Number(x.providerId));
		if (!profile.backupConfig || !ids.length) return then();
		const network = profile.network ?? 'calibration';
		stopChecking = true;
		try {
			const r = await checkCopies({ network, copies: ids.map((providerId) => ({ providerId })) }).catch(() => null);
			const down = r ? r.copies.filter((c) => !c.answers).map((c) => c.id) : [];
			// Named places Le Space blocked are replaced too.
			const blockedIds = blockedAmong(network, named);
			const out = [...new Set([...down, ...blockedIds])];
			// Without the registry's answer and nothing blocked, or all answering: nothing to say.
			if ((!r && !blockedIds.length) || !out.length) return then();
			const providers = await listProviders(network).catch(() => []);
			const plan = providers.length ? await replacementPlan({ providers, ids, down: out, regions: profile.backupConfig.regions ?? [] }) : null;
			const blocked = blockedOf(blockedIds, providers);
			placesAsk = { names: (r?.copies ?? []).filter((c) => down.includes(c.id)).map((c) => `${c.id} ${c.name}`.trim()), plan: plan && plan.replaced.some((x) => x.to) ? plan : null, allDown: Boolean(r) && r.answering === 0, then, ...(blocked ? { blocked } : {}) };
		} finally {
			stopChecking = false;
		}
	}
	// When the profile opens: named places that are blocked are said, with a
	// replacement to accept (once a visit). A region needs nothing: the start
	// and the handover to a running VM leave blocked providers out.
	let blockedOffered = false;
	$effect(() => {
		if (!loaded || blockedOffered || busy || placesAsk) return;
		const named = (profile.backupConfig?.providerIds ?? []).map(Number);
		const network = profile.network ?? 'calibration';
		const blockedIds = blockedAmong(network, named);
		if (!blockedIds.length) return;
		blockedOffered = true;
		listProviders(network)
			.catch(() => [])
			.then(async (providers) => {
				const plan = providers.length ? await replacementPlan({ providers, ids: named, down: blockedIds, regions: profile.backupConfig?.regions ?? [] }) : null;
				const blocked = blockedOf(blockedIds, providers);
				if (blocked && !placesAsk) placesAsk = { names: [], plan: plan && plan.replaced.some((x) => x.to) ? plan : null, allDown: false, then: () => {}, blocked };
			});
	});
	async function acceptPlaces() {
		const ask = placesAsk;
		if (!ask?.plan) return;
		placesAsk = null;
		await run(async () => {
			progress = tr().card.places.pushing;
			profile = await updateProfile(master, (now) => ({ ...now, backupConfig: { ...now.backupConfig, providerIds: ask.plan.ids, copies: Math.max(1, ask.plan.ids.length) } }));
			onchange();
			if (profile.running) await pushBackupPlaces(master, $state.snapshot(profile));
		});
		if (!error) ask.then();
	}
	const placesAnyway = () => {
		const ask = placesAsk;
		placesAsk = null;
		ask?.then();
	};
	const stop = () => checkPlacesThen(stopNow);
	// A VM whose restore failed runs an empty Paperless and makes no backup
	// (paperless-backup refuses): it is deleted without one, never stopped
	// with "Sichern und beenden".
	const restoreFailed = $derived(profile.running?.restore?.status === 'failed');
	const discardFailed = () => run(async () => {
		await reload();
		const run = profile.running;
		if (!run) return;
		// Whatever was put into this Paperless since the start goes with it:
		// say so, with what it holds now, and ask.
		const bytes = await vmStatus(run.host, statusToken(master)).then((s) => s?.storage?.documentsBytes).catch(() => null);
		if (!confirm(c.simple.discardConfirm(typeof bytes === 'number' ? `${format.number(Math.round(bytes / 1e6), undefined, $appLanguage)} MB` : ''))) return;
		await finishStop(await eraseStopped(master, $state.snapshot(profile), null, track('discard')));
	});
	// After a partial backup, on the person's word: erase the VM anyway, or
	// keep it and let Paperless run again. If that fails, the question stays.
	const answer = (/** @type {(p: BackupPartialError) => Promise<void>} */ fn) => {
		const asked = partial;
		if (!asked) return;
		return run(async () => {
			try {
				await fn(asked);
			} catch (e) {
				partial = asked;
				throw e;
			}
		});
	};
	const eraseAnyway = () => answer(async (p) => {
		await reload();
		const on = track('stop');
		// The stop's backup, as the VM reported it before it asked.
		stopSent = true;
		vmPage = p.status;
		// Even a partial backup must be on the chain, and new, before the VM goes.
		const onChain = backupsOnChain();
		if (onChain) await confirmStopBackup(p.status, { onChain, before: p.before, known: profile.ownBackups ?? [] });
		await finishStop(await eraseStopped(master, $state.snapshot(profile), p.status, on));
	});
	// A VM that stopped itself at the end of the paid time (paperless-period-end):
	// erased like after "Sichern und beenden", once its last backup is on the
	// chain. Without backups, or unconfirmed, it stays and the reason shows.
	let periodEndTried = false;
	let syncingEnd = false;
	/** @type {any} the status page of a VM stopped at the period's end */
	let periodEnded = $state(null);
	const eraseAtPeriodEnd = (/** @type {any} */ s) => run(async () => {
		periodEnded = s;
		const on = track('stop');
		stopSent = true;
		vmPage = s;
		progress = c.periodEnd.confirming;
		const onChain = backupsOnChain();
		if (!onChain) throw new Error(c.periodEnd.noBackups);
		await confirmPeriodEndBackup(s, { onChain, known: profile.ownBackups ?? [] });
		await finishStop(await eraseStopped(master, $state.snapshot(profile), s, on));
	}, () => eraseAtPeriodEnd(s));
	const keepVm = () => answer(async () => {
		progress = tr().card.progress.restart;
		await resumeAfterPartial(master, $state.snapshot(profile));
	});
	/** @param {any} status the VM's status page at the end of the stop */
	async function finishStop(status) {
		const made = pieceCidOfStop(status);
		const was = profile.running;
		const result = status?.stop?.backup?.backup ?? null;
		const goodAt = result?.date ?? status?.stop?.backup?.at ?? null;
		profile = await updateProfile(master, ({ running, ...rest }) =>
			made
				? {
						...rest,
						ownBackups: [made, ...(rest.ownBackups ?? []).filter((c) => c !== made)].slice(0, 50),
						lastBackup: result && { ...result, network: rest.network ?? 'calibration', payer: rest.payer, seconds: status.stop.backup.seconds ?? null },
						...(goodAt && (!rest.lastGoodBackup?.at || new Date(rest.lastGoodBackup.at) < new Date(goodAt)) ? { lastGoodBackup: { at: goodAt, copies: result?.copies?.length ?? null, requested: result?.requestedCopies ?? null, pieceCid: result?.pieceCid ?? null } } : {})
					}
				: rest
		);
		listedSeen = Boolean(made);
		// The backups this VM made with this vault's mark, the stop's among them.
		const noted = await noteVaultBackups(master, $state.snapshot(profile), status).catch(() => null);
		if (noted) profile = noted;
		// Public only: the recipient, and whether the key is the vault's own. The
		// identity goes to the header check (age) and nowhere else.
		const identity = profile.ageIdentity ? String(profile.ageIdentity) : '';
		const recipient = identity ? (() => { try { return ageRecipient(identity); } catch { return null; } })() : null;
		stopDone = { status, erase: eraseSeen, instanceHash: String(was?.instanceHash ?? ''), recipient, fromVault: Boolean(identity) && identity === ageIdentityFromMaster(master) };
		if (made && identity && result) {
			headerSeen = 'checking';
			checkBackupHeader({ backup: result, identity }).then((r) => (headerSeen = r), () => (headerSeen = 'unreachable'));
		}
		onchange();
	}
	// In the language shown: what a start still needs is named in words.
	// A new Paperless builds its own image at the first start (own-image-build.js).
	const buildFirst = $derived(buildsImageFirst(profile, BUILDER));
	// Which image this Paperless starts from, for the line under its status.
	const image = $derived(imageStatus(profile, BUILDER, { buildsAtStart: buildFirst }));
	const missing = $derived(($appLanguage, startRequirements(profile, { buildsImage: buildFirst })));
	// The card's texts in the language shown.
	const c = $derived($i18n.card);
	// Tells the page, which opens the setup when something is missing.
	$effect(() => {
		if (loaded) onmissing(missing);
	});
	// What "Auf einen Blick" shows of Paperless, its backups and how it is paid.
	$effect(() => {
		if (!loaded) return;
		onglance({
			phase,
			host: profile.running?.host ?? null,
			lastGood: lastGood ? { at: lastGood.at, copies: lastGood.copies ?? null } : null,
			backupsOn: Boolean(profile.backupConfig),
			pays: profile.leSpacePays ? 'lespace' : profile.appPays ? 'app' : profile.payer ? 'wallet' : null,
			fixedHost: Boolean(profile.dnsToken)
		});
	});

	// What "Diagnose kopieren" names of this Paperless (diagnosis.js picks and checks each value).
	$effect(() => {
		if (!loaded) return;
		noteState({
			phase,
			instanceHash: profile.running?.instanceHash ?? null,
			node: profile.running?.crnHash ?? null,
			host: profile.running?.host ?? null,
			relay: profile.running?.attestation?.relay?.host ?? null,
			image: image.own ? 'own' : 'public',
			network: profile.network ?? null,
			pays: profile.leSpacePays ? 'lespace' : profile.appPays ? 'app' : profile.payer ? 'wallet' : null,
			payer: typeof profile.payer === 'string' ? profile.payer : null
		});
	});

	// The simple view: one status, one calm progress line, one button. It starts
	// with the restore choice computed above (the newest own backup, if any), and
	// only once the backups are read, so it never starts empty by accident.
	const phase = $derived(
		busy && action === 'start' ? 'starting'
		: busy && action === 'stop' ? 'stopping'
		: busy && action === 'discard' ? 'discarding'
		: profile.running ? 'running'
		: profile.starting ? 'interrupted'
		: loaded ? 'off' : 'loading'
	);
	// The short state for the card's chip and "Auf einen Blick".
	const CHIPS = $derived(/** @type {Record<string, string>} */ (c.chips));
	const TITLES = $derived(/** @type {Record<string, string>} */ (c.titles));
	const backupsPending = $derived(Boolean(profile.ageIdentity && backupListing(profile) && backups === null));
	// The panel's times: the same steps and stamps as the start's progress, one display.
	// A stop's time stands at its last row the VM lights (the piece), the erase's at the erase.
	const STOP_ROWS = /** @type {Record<string, string>} */ ({ stop: 'piece', forget: 'forget' });
	const panelTook = $derived.by(() => {
		if (!action || !(startShown || stopShown)) return {};
		const took = panelTimes(STEPS[action].map((s) => ({ step: s.step, typical: typicalOf(s) })), times, now);
		return Object.fromEntries(Object.entries(took).map(([id, x]) => [stopShown ? STOP_ROWS[id] ?? id : id, `${x.ms != null ? `${seconds(x.ms)} ` : ''}${c.advanced.usual(minutes(x.typical))}`]));
	});
	const panelTotal = $derived(
		action && (startShown || stopShown) ? c.advanced.total(seconds((busy ? now : Object.values(times).reduce((m, t) => Math.max(m, t.to ?? 0), startedAt)) - startedAt), minutes(STEPS[action].reduce((a, s) => a + typicalOf(s), 0))) : ''
	);
	const typicalTotal = $derived(action ? STEPS[action].reduce((a, s) => a + typicalOf(s), 0) : 0);
	const elapsed = $derived(Math.max(0, (now - startedAt) / 1000));
	const share = $derived(typicalTotal ? Math.min(0.95, elapsed / typicalTotal) : 0);
	const leftMinutes = $derived(Math.max(1, Math.ceil((typicalTotal - elapsed) / 60)));
	const stepLabel = $derived(action ? (/** @type {Record<string, string>} */ (c.steps)[STEPS[action].find((s) => s.step === current)?.step ?? 'preparing']) : '');
</script>

{#snippet placesBox()}
	{#if placesAsk}
		<div class="warn-box" role="alert" data-testid="places-ask">
			{#if placesAsk.blocked}<p data-testid="places-blocked">{c.places.blocked(placesAsk.blocked.names.join(', '), placesAsk.blocked.why)}</p>{/if}
			{#if placesAsk.names.length}<p>{c.places.down(placesAsk.names.join(', '))}</p>{/if}
			{#if placesAsk.plan}
				<ul>{#each placesAsk.plan.replaced as r (r.from.id)}<li>{r.to ? c.places.instead(`${r.from.id} ${r.from.name ?? ''}`.trim(), `${r.to.id} ${r.to.name}${r.to.place ? `, ${r.to.place}` : ''}`) : c.places.none(`${r.from.id} ${r.from.name ?? ''}`.trim())}</li>{/each}</ul>
				<p class="hint">{placesAsk.blocked && !placesAsk.names.length ? c.places.blockedHint : c.places.hint}</p>
			{:else}
				<p class="hint">{c.places.noReplacement}</p>
			{/if}
			<div class="row">
				{#if placesAsk.blocked && !placesAsk.names.length}
					{#if placesAsk.plan}<button onclick={acceptPlaces} disabled={busy} data-testid="places-accept">{c.places.acceptOnly}</button>{/if}
					<button class="quiet" onclick={() => (placesAsk = null)} data-testid="places-cancel">{c.places.later}</button>
				{:else}
					{#if placesAsk.plan}<button onclick={acceptPlaces} disabled={busy} data-testid="places-accept">{c.places.accept}</button>{/if}
					<button class="secondary" onclick={placesAnyway} disabled={busy} data-testid="places-anyway">{placesAsk.allDown ? c.places.tryAnyway : c.places.goOn}</button>
					<button class="quiet" onclick={() => (placesAsk = null)} data-testid="places-cancel">{c.places.cancel}</button>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet errorBox()}
	<div class="error" role="alert" data-testid="start-error">
		<p class="error-text">{error}</p>
		{#if errorRaw}<details class="raw"><summary>{$i18n.net.details}</summary><pre>{errorRaw}</pre></details>{/if}
		{#if again}<div class="row"><button onclick={() => again?.()} disabled={busy} data-testid="error-again">{$i18n.net.again}</button></div>{/if}
	</div>
{/snippet}

{#snippet fundOffer()}
	{@const locked = busy || purchaseLocked(buying)}
	<p class="hint"><RefreshBalances label={$i18n.funds.toppedUp} testid="short-refresh" /></p>
	{#if fromPackage}
		<div class="fund" data-testid="package-offer">
			<p class="hint">{c.fund.inPackage(packageHours ?? 0)}</p>
			<button onclick={startFromPackage} disabled={locked} data-testid="start-from-package">{c.fund.startFromPackage(packageHours ?? 0)}</button>
		</div>
	{:else}
	<div class="fund" data-testid="fund-offer">
		<label>{c.fund.buyLabel}
			<select bind:value={fundHours} disabled={locked} data-testid="fund-hours">{#each [5, 10, 30] as h (h)}<option value={h}>{h} h</option>{/each}</select></label>
		<button onclick={askToBuy} disabled={locked} data-testid="fund-start">{buying.phase === 'quoting' ? c.fund.quoting : c.fund.buyAndStart}</button>
	</div>
	<HourQuote quote={buying.phase === 'open' ? buying.quote : null} short={buying.phase === 'short'} hoursAsked={buying.hours} topUpHint={c.fund.topUpHint} confirmLabel={c.fund.buyAndStart} disabled={busy || buying.phase === 'buying'} onconfirm={() => purchase.confirm()} oncancel={() => purchase.cancel()} />
	{#if buying.error}<p class="error" role="alert" data-testid="fund-error">{buying.error}</p>{/if}
	{/if}
{/snippet}

{#snippet unpaidQuestion()}
	{#if unpaidBackup}
		<div class="warn gap" role="alertdialog" aria-label={c.unpaid.label} data-testid="start-unpaid-backup">
			<p><strong>{c.unpaid.strong}</strong> {c.unpaid.text}</p>
			<p class="row">
				<button class="secondary" onclick={toPackage} data-testid="start-book-backup">{c.unpaid.book}</button>
				<button class="quiet" onclick={startWithoutBackup} disabled={busy} data-testid="start-without-backup">{c.unpaid.without}</button>
				<button class="quiet" onclick={() => (unpaidBackup = false)}>{c.unpaid.cancel}</button>
			</p>
		</div>
	{/if}
{/snippet}

{#snippet superusersWarning()}
	{#if Number(profile.running?.restore?.superusers) > 0}<p class="warn" data-testid="restore-superusers">{c.superusers(Number(profile.running?.restore?.superusers))}</p>{/if}
{/snippet}

{#snippet unmarkedWarning()}
	{#if choice === 'any' && chosenBackup}
		<div class="warn gap" data-testid="restore-unmarked">
			<p>{c.unmarked.text(chosenBackup.pieceCid.slice(-12), whenOf(chosenBackup))}</p>
			<label><input type="checkbox" data-testid="restore-unmarked-accept" checked={!unmarkedOpen} onchange={(e) => (unmarkedAccepted = e.currentTarget.checked ? (chosenBackup?.pieceCid ?? '') : '')} /> {c.unmarked.accept}</label>
		</div>
	{/if}
{/snippet}

{#snippet gapWarning()}
	{#if gap}
		<div class="warn gap" data-testid="restore-gap">
			<p>
				{#if gap === 'missing'}{c.gap.missing(known?.slice(-12) ?? '', lastGood?.pieceCid === known && lastGood?.at ? c.dated(format.dateTime(lastGood.at, undefined, $appLanguage)) : '', Boolean(chosenBackup))}
				{:else}{c.gap.older(known?.slice(-12) ?? '')}{/if}
				{c.gap.later}
			</p>
			<label><input type="checkbox" data-testid="restore-gap-accept" checked={!gapOpen} onchange={(e) => (gapAccepted = e.currentTarget.checked ? gapKey : '')} /> {c.gap.accept}</label>
		</div>
	{/if}
{/snippet}

{#if ceremony}
	<FirstStart
		view={ceremony}
		startTypical={STEPS.start.reduce((a, s) => a + typicalOf(s), 0)}
		host={profile.running?.host ?? null}
		ownImage={profile.ownImage ?? null}
		imageHash={profile.rootfsItemHash ?? null}
		plain={BUILDER?.plain ?? null}
		onminimize={() => (ceremony = ceremony && { ...ceremony, minimized: true })}
		onexpand={() => (ceremony = ceremony && { ...ceremony, minimized: false })}
		oncertificate={(show) => (ceremony = !ceremony ? null : !show && ceremony.only ? null : { ...ceremony, certificate: show })}
		onclose={() => (ceremony = null)}
	/>
{/if}
<section class="lifecycle" class:simple data-testid="lifecycle">
	{#if simple}
		<div class="status is-{phase}" data-testid="simple-status">
			<span class="dot" aria-hidden="true"></span>
			<div>
				<h1>{TITLES[phase]}</h1>
				{#if phase === 'off'}<p class="sub">{c.simple.startTakes(minutes(STEPS.start.reduce((a, s) => a + typicalOf(s), 0)))}</p>
				{:else if phase === 'starting'}<p class="sub">{c.simple.keepOpenStart}</p>
				{:else if phase === 'stopping' || phase === 'discarding'}<p class="sub">{c.simple.keepOpenStop}</p>
				{:else if phase === 'running'}<p class="sub data">{profile.running.host}</p>
				{:else if phase === 'interrupted'}<p class="sub">{c.simple.interruptedCosts}</p>{/if}
				{#if BUILDER}
					<!-- Which image: the vault's own (and whether a newer version is there), built at the first start, or the public one. -->
					<p class="image-line" data-testid="image-line">
						{#if image.own}{$i18n.ownImage.overview.built(format.date(image.builtAt ?? Date.now(), undefined, $appLanguage))}
							{#if image.newer}{' '}<span data-testid="image-newer">{$i18n.ownImage.overview.newer}</span>
								{#if phase === 'off'}{' '}<button class="link" onclick={rebuildImage} disabled={busy} data-testid="image-rebuild">{$i18n.ownImage.overview.rebuild}</button>
								{:else}{' '}<span class="hint">{$i18n.ownImage.overview.rebuildStopped}</span>{/if}
							{/if}
						{:else if image.buildsAtStart}<span data-testid="first-build">{c.simple.firstBuild}</span>
						{:else}{$i18n.ownImage.overview.publicImage}{/if}
					</p>
				{/if}
				{#if profile.backupConfig}
					<!-- The answer people look for first: when the documents were last safe. -->
					<p class="good" class:stale={goodStale} data-testid="last-good-backup">{#if lastGood}{fromStop ? c.simple.lastAtStop : c.simple.lastGood}: <strong>{goodWhen(lastGood.at)}</strong>{lastGood.copies ? ` · ${c.simple.copies(lastGood.copies)}` : ''}{#if newerOnChain}<br /><span data-testid="newer-on-chain">{c.simple.newerOnChain(c.simple.copies(backups?.[0]?.copies.length ?? 0))}</span>{/if}{:else}{c.simple.noneKnown}{/if}</p>
				{/if}
			</div>
		</div>

		{#if phase === 'starting' || phase === 'stopping' || phase === 'discarding'}
			<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(share * 100)} aria-label={TITLES[phase]}><span style="width: {Math.round(share * 100)}%"></span></div>
			<p class="calm" data-testid="simple-progress">{c.simple.left(stepLabel, leftMinutes)}</p>
			{#if startShown || stopShown}<StartPanel rows={panel} t={panelShownT} times={panelTook} total={panelTotal} testid={stopShown ? 'stop-panel' : 'start-panel'} />{/if}
		{:else if phase === 'running'}
			<a class="cta" href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="simple-open">{c.simple.open}</a>
			{@render superusersWarning()}
			{#if profile.running.restore?.status === 'failed'}<p class="error">{c.simple.restoreFailed}</p>{/if}
			<div class="login" data-testid="simple-login">
				<p class="label">{c.simple.login}</p>
				<p>{c.simple.user} <code>admin</code></p>
				<p>{c.simple.password} {#if showPassword}<code data-testid="simple-password">{adminPassword}</code>{:else}<code>••••••••</code>{/if}</p>
				<div class="row">
					<button type="button" class="small" onclick={() => (showPassword = !showPassword)}>{showPassword ? c.simple.hide : c.simple.show}</button>
					<button type="button" class="small" onclick={copyPassword}>{c.simple.copy}</button>
				</div>
			</div>
			{#if profile.backupConfig && !restoreFailed}<BackupNow {master} {profile} known={lastGood} disabled={busy || stopChecking} guard={checkPlacesThen} onbusy={(b) => (backingUp = b)} ongood={rememberGood} />{/if}
			<Evidence rows={evidence} t={evidenceT} onagain={busy ? null : checkAgain} />
			{#if restoreFailed}<button class="secondary stop" onclick={discardFailed} disabled={busy} data-testid="simple-discard">{c.simple.discard}</button>
			{:else}
				{#if reach === 'bad'}<p class="warn" role="status" data-testid="stop-reach-bad">{c.simple.stopReachBad}</p>{/if}
				<button class="secondary stop" onclick={stop} disabled={busy || backingUp || stopChecking} data-testid="simple-stop">{c.simple.stop}</button>
				{#if stopChecking}<p class="hint" role="status" data-testid="stop-checking">{c.simple.stopChecking}</p>{/if}
			{/if}
			<Storage {master} {profile} />
			{#if profile.ageIdentity && backupListing(profile)}<TrialRestore {master} {profile} listing={backupListing(profile)} onchange={async () => { profile = await loadProfile(master); onchange(); }} />{/if}
		{:else if phase === 'interrupted'}
			<button class="cta" onclick={resume} disabled={busy} data-testid="simple-resume">{c.simple.resume}</button>
			<button class="quiet" onclick={discard} disabled={busy} data-testid="simple-discard-start">{c.advanced.discard}</button>
		{:else if phase === 'off'}
			{#if missing.length}
				<p class="hint">{c.simple.notSetUp}</p>
				<button class="secondary" onclick={onadvanced}>{c.simple.openSetup}</button>
			{:else}
				<button class="cta" onclick={start} disabled={busy || backupsPending || Boolean(backupsError) || gapOpen || unmarkedOpen} data-testid="start">{c.simple.start}</button>
				{@render unpaidQuestion()}
				{#if backupsPending}<p class="hint">{c.simple.readingBackups}</p>
				{:else if backupsError}<p class="warn">{backupsError} {c.simple.tryAgain}</p>
				{:else if profile.ageIdentity}<p class="hint" data-testid="simple-restore">{chosenBackup ? c.simple.startsWith(chosenBackup.pieceCid.slice(-12), whenOf(chosenBackup)) : c.simple.startsEmpty}</p>{/if}
				{@render gapWarning()}
				{@render unmarkedWarning()}
				<Storage {master} {profile} />
			{/if}
		{/if}
		<!-- A stop's or an erase's panel stays once it is over, with where the backup went. -->
		{#if stopShown && !busy}<StartPanel rows={panel} t={panelShownT} times={panelTook} total={panelTotal} testid="stop-panel" />{/if}
		{#if stopEvidence.length}<Evidence rows={stopEvidence} t={{ ...evidenceT, title: evidenceT.stopTitle }} />{/if}
		{#if chainBackup}<BackupChain network={profile.network ?? 'calibration'} backup={chainBackup} />{/if}
		{#if phase !== 'running' && profile.trial}<TrialRestore {master} {profile} listing={backupListing(profile)} onchange={async () => { profile = await loadProfile(master); onchange(); }} />{/if}
		{#if profile.backupRevokePending && !profile.running}<p class="hint" data-testid="revoke-pending">{c.revokePending}</p>{/if}
		{#if goneNote}<p class="hint" role="status" data-testid="start-gone">{goneNote}</p>{/if}
		{#if periodEnded}<p class="hint" role="status" data-testid="period-end-stopped">{c.periodEnd.stopped}</p>{/if}
		{@render placesBox()}
		{#if error}{@render errorBox()}{/if}
		{#if error && !busy && !profile.running && profile.ownImage?.previous}<p class="hint" data-testid="previous-image"><button class="secondary" onclick={startPrevious} disabled={busy} data-testid="start-previous">{$i18n.ownImage.previousStart}</button> {$i18n.ownImage.previousHint}</p>{/if}
		{#if partial}
			<div class="partial" role="alert" data-testid="stop-partial">
				<p class="warn">{partial.message}</p>
				<p class="hint">{c.partial.hint(partial.requested - partial.copies)}</p>
				<div class="row">
					<button onclick={eraseAnyway} disabled={busy} data-testid="stop-partial-erase">{c.partial.erase}</button>
					<button class="secondary" onclick={keepVm} disabled={busy} data-testid="stop-partial-keep">{c.partial.keep}</button>
				</div>
			</div>
		{/if}
		{#if errorLog.length}<details class="log" data-testid="simple-backup-log"><summary>{c.simple.vmDetails}</summary><pre>{errorLog.join('\n')}</pre><ProviderHealth network={profile.network ?? 'calibration'} ids={healthIds} /></details>{/if}
		{#if short && CREDITS_URL && (profile.appPays || profile.leSpacePays)}{@render fundOffer()}{/if}
		{#if bought}<p class="hint" role="status" data-testid="fund-bought">{bought}</p>{/if}
	{:else}
		<header class="head">
			<h2>Paperless-ngx</h2>
			<span class="chip" class:on={phase === 'running'} data-testid="paperless-chip">{CHIPS[phase]}</span>
		</header>
		<p class="purpose">{c.advanced.purpose}</p>
		{#if profile.running}
			<a class="cta" href={`https://${profile.running.host}/`} target="_blank" rel="noopener">{c.simple.open}</a>
			<p>{c.advanced.runs} <a href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="paperless-link">{profile.running.host}</a></p>
			{@render superusersWarning()}
			{#if profile.running.restore?.status === 'failed'}<p class="error" data-testid="restore-failed">{c.advanced.restoreFailed(`${profile.running.restore.reason ?? c.advanced.noReason}${profile.running.restore.error ? `: ${profile.running.restore.error}` : ''}`)}</p>{/if}
			{#if profile.running.dataDisk === 'encrypted'}<p class="hint" data-testid="data-disk">{c.advanced.diskEncrypted}</p>
			{:else if profile.running.dataDisk === 'plain'}<p class="warn" data-testid="data-disk">{c.advanced.diskPlain}</p>{/if}
			<Evidence rows={evidence} t={evidenceT} onagain={busy ? null : checkAgain} />
			<p data-testid="paperless-login">{c.advanced.login} <code>admin</code>,
				{#if showPassword}<code data-testid="admin-password">{adminPassword}</code>{:else}<span>••••••••</span>{/if}
				<button type="button" class="small" onclick={() => (showPassword = !showPassword)}>{showPassword ? c.simple.hide : c.simple.show}</button>
				<button type="button" class="small" onclick={copyPassword}>{c.simple.copy}</button>
			</p>
			{#if restoreFailed}<button class="secondary stop" onclick={discardFailed} disabled={busy} data-testid="discard">{c.simple.discard}</button>
			{:else}
				{#if reach === 'bad'}<p class="warn" role="status">{c.simple.stopReachBad}</p>{/if}
				<button class="secondary stop" onclick={stop} disabled={busy || stopChecking} data-testid="stop">{c.simple.stop}</button>
				{#if stopChecking}<p class="hint" role="status">{c.simple.stopChecking}</p>{/if}
			{/if}
		{:else}
			{#if profile.ageIdentity}
				<fieldset class="restore">
					<legend>{c.advanced.atStart}</legend>
					{#if production && split.own.length}
						<label><input type="radio" bind:group={choice} value="latest" data-testid="restore-latest" />
							{c.advanced.restoreLatest}
							<small data-testid="latest-backup">({pick(split.own).pieceCid.slice(-12)}{whenOf(pick(split.own))}{sizePart(pick(split.own))}, {c.advanced.copiesAt(pick(split.own).copies.length, wherePlaces(pick(split.own)))})</small>
						</label>
					{/if}
					<label><input type="radio" bind:group={choice} value="own" disabled={!split.own.length} />
						{c.advanced.restoreOwn}
						{#if split.own.length}<small data-testid="newest-backup">({pick(split.own).pieceCid.slice(-12)}{whenOf(pick(split.own))}{sizePart(pick(split.own))}, {c.advanced.copiesAt(pick(split.own).copies.length, wherePlaces(pick(split.own)))})</small>
						{:else if backups}<small>{c.advanced.noneOwn}</small>{:else}<small>{c.advanced.reading}</small>{/if}
					</label>
					{#if split.other.length}
						<label><input type="radio" bind:group={choice} value="any" />
							{c.advanced.restoreOther} ({unmarkedPick(split.other).pieceCid.slice(-12)}{sizePart(unmarkedPick(split.other))}, {wherePlaces(unmarkedPick(split.other))})
							<small>{c.advanced.otherHint(split.other.length)}</small>
						</label>
					{/if}
					<label><input type="radio" bind:group={choice} value="empty" /> {c.advanced.empty}</label>
					{#if backupsError}<small class="hint">{backupsError}</small>{/if}
				</fieldset>
				{@render gapWarning()}
				{@render unmarkedWarning()}
				{#if chosenBackup}<BackupExport backup={chosenBackup} identity={profile.ageIdentity} />{/if}
				{#if chainBackup}<BackupChain network={profile.network ?? 'calibration'} backup={chainBackup} />{/if}
			{/if}
			{#if profile.starting && !busy}
				<div class="interrupted" data-testid="start-interrupted">
					<p>{c.advanced.interrupted.before} <code>{profile.starting.instanceHash.slice(0, 12)}</code>{c.advanced.interrupted.requested(format.dateTime(profile.starting.at, { dateStyle: 'short', timeStyle: 'short' }, $appLanguage))}</p>
					<button class="cta" onclick={resume} disabled={busy}>{c.simple.resume}</button>
					<button class="quiet" onclick={discard} disabled={busy}>{c.advanced.discard}</button>
				</div>
			{:else}
				<p class="role-line" data-testid="role-line">{profile.role === 'primary' ? c.advanced.rolePrimary : c.advanced.roleTest}</p>
				<button class="cta" onclick={start} disabled={busy || missing.length > 0 || gapOpen || unmarkedOpen} data-testid="start">{c.simple.start}</button>
				{@render unpaidQuestion()}
				{#if missing.length}<p class="hint">{c.advanced.stillMissing(missing.join(', '))}</p>{/if}
			{/if}
			{#if BUILDER && hasOwnImage(profile, BUILDER.plain.sha256)}<button class="quiet" onclick={showCertificate} data-testid="open-certificate">{$i18n.first.cert.open}</button>{/if}
		{/if}
		{#if startShown}<StartPanel rows={panel} t={panelT} times={panelTook} total={panelTotal} />{/if}
		<!-- A start, a stop and an erase each show their panel only, with the times per row. -->
		{#if stopShown}<StartPanel rows={panel} t={panelShownT} times={panelTook} total={panelTotal} testid="stop-panel" />{/if}
		{#if stopEvidence.length}<Evidence rows={stopEvidence} t={{ ...evidenceT, title: evidenceT.stopTitle }} />{/if}
		{#if progress}<p data-testid="progress">{progress} …</p>{/if}
		{#if profile.backupRevokePending && !profile.running}<p class="hint" data-testid="revoke-pending">{c.revokePending}</p>{/if}
		{#if goneNote}<p class="hint" role="status" data-testid="start-gone">{goneNote}</p>{/if}
		{#if periodEnded}<p class="hint" role="status" data-testid="period-end-stopped">{c.periodEnd.stopped}</p>{/if}
		{@render placesBox()}
		{#if error}{@render errorBox()}{/if}
		{#if error && !busy && !profile.running && profile.ownImage?.previous}<p class="hint" data-testid="previous-image"><button class="secondary" onclick={startPrevious} disabled={busy} data-testid="start-previous">{$i18n.ownImage.previousStart}</button> {$i18n.ownImage.previousHint}</p>{/if}
		{#if partial}
			<div class="partial" role="alert" data-testid="stop-partial">
				<p class="warn">{partial.message}</p>
				<p class="hint">{c.partial.hint(partial.requested - partial.copies)}</p>
				<div class="row">
					<button onclick={eraseAnyway} disabled={busy} data-testid="stop-partial-erase">{c.partial.erase}</button>
					<button class="secondary" onclick={keepVm} disabled={busy} data-testid="stop-partial-keep">{c.partial.keep}</button>
				</div>
			</div>
		{/if}
		{#if short && CREDITS_URL && profile.appPays}{@render fundOffer()}{/if}
		{#if bought}<p class="hint" role="status" data-testid="fund-bought">{bought}</p>{/if}
		{#if errorLog.length}
			<details open class="log"><summary>{c.advanced.vmSays}</summary><pre data-testid="backup-log">{errorLog.join('\n')}</pre><ProviderHealth network={profile.network ?? 'calibration'} ids={healthIds} /></details>
		{/if}
		{#if !profile.running && profile.lastBackup}
			{@const b = profile.lastBackup}
			<details class="backup-card" data-testid="last-backup">
				<summary>{c.last.title(b.date ? format.dateTime(b.date, undefined, $appLanguage) : b.name, b.copies?.length ?? 0, b.requestedCopies ?? b.copies?.length, Boolean(b.complete))}</summary>
				<dl>
					<dt>{c.last.network}</dt><dd>Filecoin {b.network === 'mainnet' ? 'Mainnet' : c.last.testnet}</dd>
					<dt>{c.last.paidBy}</dt><dd><code>{b.payer}</code></dd>
					<dt>Piece CID</dt><dd><code>{b.pieceCid}</code></dd>
					{#if b.size}<dt>{c.last.size}</dt><dd>{format.number(b.size / 1048576, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, $appLanguage)} MiB {c.last.encrypted}{b.parts?.length > 1 ? c.last.inParts(b.parts.length) : ''}</dd>{/if}
					{#if b.seconds}<dt>{c.last.duration}</dt><dd>{b.seconds} s</dd>{/if}
				</dl>
				<ul>
					{#each b.copies ?? [] as copy (copy.providerId + copy.dataSetId)}
						<li>{c.last.copy({ provider: copy.providerId, place: copy.location ? place(copy.location) : '', dataSet: copy.dataSetId, piece: copy.pieceId, isNew: Boolean(copy.isNewDataSet) })}
							{#if httpsUrl(copy.retrievalUrl)}<br /><a href={httpsUrl(copy.retrievalUrl)} target="_blank" rel="noopener">{c.last.fetch}</a> <small>{c.last.fetchHint}</small>{/if}</li>
					{/each}
				</ul>
				{#if b.failedAttempts}<p class="hint">{c.last.failed(b.failedAttempts)}</p>{/if}
			</details>
		{/if}
	{/if}
</section>

<style>
	.good { margin: 0.4rem 0 0; font-size: 0.9rem; color: var(--text-2); }
	.good strong { color: var(--text); }
	.good.stale { color: var(--warn); }
	.simple { padding: 1.5rem 1.25rem; }
	.status { display: flex; gap: 1rem; align-items: flex-start; }
	.status h1 { font-size: 1.6rem; margin: 0; line-height: 1.2; }
	.status .sub { margin: 0.3rem 0 0; color: var(--text-2); }
	.status .sub.data { font-family: var(--mono); font-size: 0.875rem; word-break: break-all; }
	.dot { flex: none; width: 0.9rem; height: 0.9rem; margin-top: 0.5rem; border-radius: 50%; background: var(--line); }
	.is-running .dot { background: var(--ok); box-shadow: 0 0 0 5px var(--ok-bg); }
	.is-starting .dot, .is-stopping .dot, .is-interrupted .dot { background: var(--accent); box-shadow: 0 0 0 5px var(--warn-bg); }
	@media (prefers-reduced-motion: no-preference) {
		.is-starting .dot, .is-stopping .dot { animation: pulse 1.6s ease-in-out infinite; }
		@keyframes pulse { 50% { opacity: 0.35; } }
	}
	.meter { height: 6px; margin: 1.25rem 0 0.5rem; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
	.meter span { display: block; height: 100%; background: var(--accent); border-radius: 999px; transition: width 1s linear; }
	.calm { color: var(--text-2); font-size: 0.9rem; margin: 0; }
	.cta { display: block; width: 100%; margin: 1.25rem 0 0.75rem; padding: 0.85rem 1.25rem; text-align: center; font-weight: 600; font-size: 1.05rem; color: var(--cta-text); background: var(--cta-bg); border: 1px solid var(--cta-bg); border-radius: 999px; text-decoration: none; }
	.secondary { display: block; width: 100%; margin: 0.75rem 0 0; background: transparent; color: var(--text); border-color: var(--line); }
	/* Ends the paid VM: the style guide's warning colour (amber), so it stands out without competing with the one lime CTA. */
	.secondary.stop { background: var(--warn-bg); color: var(--warn); border-color: var(--warn); font-weight: 600; }
	.secondary.stop:hover:not(:disabled) { background: color-mix(in srgb, var(--warn) 16%, var(--warn-bg)); }
	.login { margin: 1rem 0 0; padding: 0.9rem 1rem; background: var(--surface-2); border-radius: var(--radius-sm); }
	.login p { margin: 0.15rem 0; }
	.login .label { color: var(--text-2); font-size: 0.85rem; margin-bottom: 0.35rem; }
	.login code { word-break: break-all; }
	.warn-box { margin: 0.75rem 0; padding: 0.6rem 0.8rem; border: 1px solid var(--warn); border-left-width: 4px; border-radius: var(--radius-sm, 6px); background: var(--warn-bg); }
	.warn-box ul { margin: 0.3rem 0; padding-left: 1.2rem; }
	.error-text { margin: 0; }
	.raw { margin-top: 0.4rem; font-size: 0.85rem; color: var(--dim); }
	.raw pre { white-space: pre-wrap; word-break: break-word; margin: 0.3rem 0 0; }
	.row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }
	.small { padding: 0.35rem 0.85rem; font-size: 0.875rem; background: var(--surface); color: var(--text); border-color: var(--line); }
	.simple .hint { margin: 0.5rem 0 0; font-size: 0.9rem; }
	.simple .warn, .simple .error { margin: 0.75rem 0 0; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.9rem; }
	.simple .warn { background: var(--warn-bg); }
	.simple .error { background: var(--danger-bg); }
	.warn { color: var(--warn); }
	.gap { margin: 0.75rem 0 0; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); background: var(--warn-bg); font-size: 0.9rem; }
	.gap p { margin: 0 0 0.4rem; }
	.log pre { white-space: pre-wrap; font-size: 0.8rem; background: var(--surface-2); padding: 0.5rem; }
	.backup-card { margin-top: 1rem; }
	.backup-card dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 0.8rem; }
	.backup-card dt { color: var(--text-2); }
	.backup-card ul { padding-left: 1.2rem; }
	@media (max-width: 480px) { .backup-card dl { grid-template-columns: 1fr; } }
	.head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
	.head h2 { margin: 0; font-size: 1.15rem; }
	.purpose { color: var(--text-2); font-size: 0.9rem; margin: 0.25rem 0 0.75rem; }
	.chip { font-size: 0.8rem; padding: 0.1rem 0.6rem; border-radius: 999px; background: var(--surface-2); color: var(--text-2); white-space: nowrap; }
	.chip.on { background: var(--ok-bg); color: var(--ok); }
	.cta:disabled { opacity: 0.5; }
	.lifecycle { margin: 0 0 1rem; padding: 1.25rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
	button { padding: 0.6rem 1.1rem; font-size: 1rem; margin: 0.25rem 0.25rem 0.25rem 0; }
	.hint { color: var(--text-2); }
	.restore { border: none; padding: 0; margin: 0 0 0.75rem; }
	.restore label { display: block; }
	.error { color: var(--danger); }
	.role-line { font-size: 0.9rem; color: var(--text-2); margin: 0.25rem 0; }
	.fund { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: end; margin: 0.5rem 0; }
	.fund select { margin-left: 0.4rem; }
	.interrupted { padding: 0.5rem 0.75rem; background: var(--warn-bg); border-radius: 4px; }
	.quiet { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; }
	.image-line { margin: 0.35rem 0 0; font-size: 0.9rem; color: var(--text-2); }
	.image-line .link { background: none; border: none; padding: 0; color: var(--accent-2-text); text-decoration: underline; cursor: pointer; font: inherit; }
</style>
