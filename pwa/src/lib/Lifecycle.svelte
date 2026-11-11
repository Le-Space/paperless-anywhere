<script>
	import { backupListing, loadProfile, updateProfile } from '$lib/profile.js';
	import { AlephShortError, BackupPartialError, eraseStopped, resumeAfterPartial, resumeStart, retryBackupRevoke, startPaperless, startRequirements, stopPaperless } from '$lib/lifecycle.js';
	import { vmStatus } from '$lib/vm.js';
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
	import { backupSize, knownBackup, listBackups, newerBackup, pieceCidOfStop, place, restoreEntry, restoreGap, splitOwn } from '$lib/backups.js';
	import { paperlessSecrets } from '$lib/keys/derive.js';
	import { startingInstance } from '$lib/starting.js';
	import BackupNow from '$lib/BackupNow.svelte';
	import TrialRestore from '$lib/TrialRestore.svelte';
	import ProviderHealth from '$lib/ProviderHealth.svelte';
	import { providerIdsIn } from '$lib/providers.js';

	/** @type {{ master: Uint8Array, simple?: boolean, version?: number, onchange?: () => void, onadvanced?: () => void, onmissing?: (missing: string[]) => void, onglance?: (g: Glance) => void }} */
	let { master, simple = false, version = 0, onchange = () => {}, onadvanced = () => {}, onmissing = () => {}, onglance = () => {} } = $props();
	/** @typedef {{ phase: string, host: string | null, lastGood: { at: string, copies: number | null } | null, backupsOn: boolean, pays: 'lespace' | 'app' | 'wallet' | null, fixedHost: boolean }} Glance */

	/** @type {Record<string, any>} */
	let profile = $state({});
	let progress = $state('');
	// The steps of a start and a stop, with what they took in our runs so far.
	// Start, live on mainnet 2026-11-11 (1 GB backup restored): measure 9-14 s,
	// placing 108 s, port 23 s, attestation and unlock 199 s, then Paperless
	// and the restore. The live tests of 2026-10-22 took 336-399 s in all
	// without a restore; a restore of about 1 GB adds about 5 min.
	const STEPS = {
		start: [
			{ step: 'measure', label: 'Messwerte berechnen', typical: 10 },
			{ step: 'instance', label: 'VM anfordern und platzieren', typical: 90 },
			{ step: 'network', label: 'Port 443 und Adresse', typical: 25 },
			{ step: 'unlock', label: 'VM prüfen (AMD) und entsperren', typical: 180 },
			{ step: 'ready', label: 'Paperless-ngx startet (Container, Zertifikat)', typical: 300, typicalWithRestore: 600 }
		],
		stop: [
			// With backups on, the stop waits for one: export, encryption, upload
			// to two providers and their confirmation on chain (about 6-8 min,
			// mostly fixed costs). Erasing waits for the node to confirm.
			{ step: 'stop', label: 'Stopp anfordern (letzte Sicherung)', typical: 10, typicalWithBackup: 540 },
			{ step: 'forget', label: 'VM löschen', typical: 60 }
		]
	};
	/** @type {'start' | 'stop' | ''} */
	let action = $state('');
	/** @type {Record<string, { from: number, to?: number }>} */
	let times = $state({});
	let current = $state('');
	let startedAt = $state(0);
	/** @type {any} the VM's status page during the last step, once it answers */
	let vmStart = $state(null);
	// What the VM reports about its own start (status page v2), in order.
	const SUBSTEPS = [
		{ key: 'docker', label: 'Docker bereit' },
		{ key: 'images', label: 'Container-Images geladen' },
		{ key: 'containers', label: 'Container laufen' },
		{ key: 'cert', label: 'Zertifikat ausgestellt' },
		{ key: 'paperless', label: 'Paperless-ngx antwortet' }
	];
	let now = $state(Date.now());
	let ticker = 0;
	const track = (/** @type {'start' | 'stop'} */ kind) => {
		action = kind;
		times = {};
		vmStart = null;
		current = '';
		startedAt = Date.now();
		clearInterval(ticker);
		ticker = setInterval(() => (now = Date.now()), 1000);
		return (/** @type {{ step: string, detail?: string, status?: any, instanceHash?: string }} */ { step, detail, status, instanceHash }) => {
			progress = detail ?? step;
			if (instanceHash) startingInstance.set(instanceHash);
			if (status?.start) vmStart = status.start;
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
		if (minutes < 60) return minutes <= 1 ? 'gerade eben' : `vor ${minutes} Minuten`;
		const hours = Math.floor(minutes / 60);
		if (hours < 48) return `vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
		return `vor ${Math.floor(hours / 24)} Tagen`;
	};
	const goodWhen = (/** @type {string} */ at) => {
		const d = new Date(at);
		const time = d.toLocaleString('de-DE', d.toDateString() === new Date(nowTick).toDateString() ? { hour: '2-digit', minute: '2-digit' } : { dateStyle: 'medium', timeStyle: 'short' });
		return `${time} (${ago(nowTick - d.getTime())})`;
	};
	/** A backup that reached providers: remember it if newer. @param {{ at: string, copies?: number, requested?: number }} good */
	async function rememberGood(good) {
		if (!good?.at || (profile.lastGoodBackup?.at && new Date(profile.lastGoodBackup.at) >= new Date(good.at))) return;
		profile = await updateProfile(master, (now) =>
			now.lastGoodBackup?.at && new Date(now.lastGoodBackup.at) >= new Date(good.at) ? now : { ...now, lastGoodBackup: { at: good.at, copies: good.copies ?? null, requested: good.requested ?? null } }
		);
	}
	const healthIds = $derived([...new Set([...providerIdsIn(errorLog), ...(profile.backupConfig?.providerIds ?? [])])]);
	// A stop whose backup reached fewer providers than requested: Paperless is
	// paused and the VM waits for the person to erase it anyway or keep it.
	/** @type {BackupPartialError | null} */
	let partial = $state(null);
	let busy = $state(false);
	// A backup requested from the overview runs: no stop meanwhile.
	let backingUp = $state(false);
	/** @type {any[] | null} */
	let backups = $state(null);
	let backupsError = $state('');
	// Only this vault's own backups are offered by default: the test data sets
	// also hold backups encrypted to other keys (round trips), which this vault
	// cannot decrypt (live: "age could not decrypt the piece").
	let choice = $state('empty');
	const split = $derived(splitOwn(backups ?? [], profile.ownBackups ?? []));
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
	const defaultChoice = (list) => (production && list.length ? 'latest' : splitOwn(list, profile.ownBackups ?? []).own.length ? 'own' : 'empty');
	const chosenBackup = $derived(choice === 'latest' ? pick(backups ?? []) : choice === 'own' ? pick(split.own) : choice === 'any' ? pick(split.other) : null);
	// The chain's answer against what the sealed profile knows: a start that
	// would go back behind the last known backup (the list lacks it, or the
	// choice is older) waits for the person to say so.
	const known = $derived(knownBackup(profile));
	const gap = $derived(backups && !backupsError ? restoreGap(backups, chosenBackup, known) : null);
	const gapKey = $derived(`${gap}:${choice}:${chosenBackup?.pieceCid ?? ''}`);
	let gapAccepted = $state('');
	const gapOpen = $derived(Boolean(gap) && gapAccepted !== gapKey);
	// The date of a backup, where the profile knows it (the chain has none).
	const whenOf = (b) => (b && lastGood?.pieceCid === b.pieceCid && lastGood.at ? `, vom ${new Date(lastGood.at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}` : '');
	const wherePlaces = (b) => b.copies.map((c) => c.place || `Anbieter ${c.providerId}`).join(' und ');
	// Size, and the parts a large backup went up in: shown as one backup.
	const sizeOf = (b) => [backupSize(b.size), b.parts?.length > 1 ? `in ${b.parts.length} Teilen` : ''].filter(Boolean).join(' ');
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
		loaded = true;
		// A revoke that failed when the VM was deleted, as long as no VM uses the key.
		if (profile.backupRevokePending && !busy) revoking = retryBackupRevoke(master, $state.snapshot(profile)).then(() => {}, () => {});
		// A stop that ended partial while this page was closed still waits.
		if (profile.running && !busy && !partial)
			vmStatus(profile.running.host, statusToken(master))
				.then((s) => { if (s?.phase === 'stop-partial' && !busy) partial = new BackupPartialError(s); })
				.catch(() => {});
		const listing = await listingNow();
		if (listing && profile.ageIdentity) {
			backupsError = '';
			listBackups({ network: profile.network ?? 'calibration', ...listing })
				.then((list) => ((backups = list), (choice = defaultChoice(list))))
				.catch(() => ((backups = []), (backupsError = 'Die Sicherungen ließen sich gerade nicht lesen.')));
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
		if (!(short && CREDITS_URL && profile.appPays && !profile.leSpacePays)) return;
		creditsBalance(master)
			.then((b) => (packageHours = b?.plan?.hoursLeft == null ? null : Math.floor(b.plan.hoursLeft)))
			.catch(() => (packageHours = null));
	});
	const fromPackage = $derived(Boolean(short && CREDITS_URL && profile.appPays && !profile.leSpacePays && packageHours != null && packageHours >= 1));
	// Le Space pays the VM from the package from now on (model A), then start.
	const startFromPackage = () => run(async () => {
		progress = 'Le Space bezahlt die VM jetzt aus deinem Paket';
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
	async function run(fn) {
		// Another action closes an open confirmation; it buys nothing.
		purchase.cancel();
		error = '';
		errorLog = [];
		short = null;
		partial = null;
		busy = true;
		try {
			await fn();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			errorLog = [.../** @type {any} */ ((e)?.facts ?? []), .../** @type {any} */ ((e)?.log ?? [])];
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

	const start = () => run(startNow);
	/**
	 * Model A: ask Le Space Credits for this app's delegation on the account
	 * that pays the VM, keep that account in the profile, and wait until Aleph
	 * shows the delegation (an INSTANCE before that would be refused).
	 */
	async function leSpaceOwner() {
		progress = 'Le Space Credits: Freigabe für die VM holen';
		const a = await vmAuthorize(master);
		if (profile.vmOwner !== a.owner) profile = await updateProfile(master, (now) => ({ ...now, vmOwner: a.owner }));
		const app = privateKeyToAccount(alephPrivateKey(master)).address;
		for (let i = 0; i < 30; i++) {
			if (isAuthorized(await readAuthorizations(a.owner).catch(() => []), app)) return a.owner;
			await new Promise((r) => setTimeout(r, 4000));
		}
		throw new Error('Aleph zeigt die Freigabe von Le Space noch nicht. In ein paar Minuten noch einmal starten.');
	}
	async function startNow() {
		// A retried revoke first: the start authorizes the key again after it.
		await revoking;
		await reload();
		await revoking;
		if (profile.leSpacePays) await leSpaceOwner();
		const chosen = chosenBackup;
		if (gapOpen) throw new Error('Der Start wartet auf deine Bestätigung: die letzte bekannte Sicherung würde nicht eingespielt.');
		const forStart = { ...$state.snapshot(profile), restoreEntry: chosen ? restoreEntry(chosen) : null };
		// Once Aleph has the VM, the profile knows it: a reload carries on from there.
		const onRequested = async (starting) => {
			profile = await updateProfile(master, (now) => ({ ...now, starting }));
			onchange();
		};
		await finishStart(() => startPaperless(master, forStart, track('start'), { onRequested }));
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
			progress = 'Le Space Credits: Stunden kaufen';
			const app = privateKeyToAccount(alephPrivateKey(master)).address;
			const before = profile.leSpacePays ? null : (await alephBalance(app).catch(() => null))?.credits ?? null;
			const funded = await fundVm(master, hours);
			// What the account holds now, from the service itself.
			const now = await creditsBalance(master).catch(() => null);
			bought = `${hours} Stunden gekauft für ${amount(funded.chargedCredits / 100)} €.${now ? ` Guthaben jetzt ${amount(now.credits / 100)} €.` : ''}${quote?.hoursAfter != null ? ` VM-Stunden: ${amount(quote.hoursAfter, 1)} h.` : ''}`;
			let payer = profile.leSpacePays ? (profile.vmOwner ?? app) : app;
			if (funded.to && funded.to.toLowerCase() !== app.toLowerCase()) payer = funded.to;
			progress = 'Warte, bis Aleph die Gutschrift zeigt';
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
				if (i === 35) throw new Error('Die Gutschrift ist bei Aleph noch nicht zu sehen. In ein paar Minuten noch einmal starten – nicht noch einmal kaufen, sonst werden die Stunden doppelt gekauft.');
				await new Promise((res) => setTimeout(res, 5000));
			}
			if (payer.toLowerCase() !== app.toLowerCase() && !profile.leSpacePays) {
				// The hours are on the sub-account: from now on Le Space pays the VM from the package.
				progress = 'Le Space bezahlt die VM jetzt aus deinem Paket';
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
			progress = 'Sicherungen nachsehen';
			const newer = newerBackup(await listBackups({ network: profile.network ?? 'calibration', ...listing }), chosen);
			if (newer) profile = await updateProfile(master, (now) => (now.starting ? { ...now, starting: { ...now.starting, restoreEntry: restoreEntry(newer) } } : now));
		}
		await finishStart(() => resumeStart(master, $state.snapshot(profile), track('start')));
	});
	/** @param {() => Promise<any>} bringUp */
	async function finishStart(bringUp) {
		try {
			const running = await bringUp();
			profile = await updateProfile(master, ({ starting, ...rest }) => ({ ...rest, running }));
		} finally {
			startingInstance.set('');
		}
		onchange();
	}
	// Give up on an interrupted start; the VM stays in the list below to remove.
	const discard = () => run(async () => {
		profile = await updateProfile(master, ({ starting, ...rest }) => rest);
		onchange();
	});
	const stop = () => run(async () => {
		await reload();
		finishStop(await stopPaperless(master, $state.snapshot(profile), track('stop')));
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
		finishStop(await eraseStopped(master, $state.snapshot(profile), p.status, track('stop')));
	});
	const keepVm = () => answer(async () => {
		progress = 'Paperless-ngx wieder starten';
		await resumeAfterPartial(master, $state.snapshot(profile));
	});
	/** @param {any} status the VM's status page at the end of the stop */
	async function finishStop(status) {
		const made = pieceCidOfStop(status);
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
		onchange();
	}
	const missing = $derived(startRequirements(profile));
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

	// The simple view: one status, one calm progress line, one button. It starts
	// with the restore choice computed above (the newest own backup, if any), and
	// only once the backups are read, so it never starts empty by accident.
	const phase = $derived(
		busy && action === 'start' ? 'starting'
		: busy && action === 'stop' ? 'stopping'
		: profile.running ? 'running'
		: profile.starting ? 'interrupted'
		: loaded ? 'off' : 'loading'
	);
	// The short state for the card's chip and "Auf einen Blick".
	const CHIPS = { loading: '…', off: 'aus', starting: 'startet', stopping: 'wird beendet', running: 'läuft', interrupted: 'Start unterbrochen' };
	const TITLES = {
		loading: 'Einen Moment …',
		off: 'Paperless-ngx ist aus',
		starting: 'Paperless-ngx startet',
		stopping: 'Paperless-ngx wird gesichert und beendet',
		running: 'Paperless-ngx läuft',
		interrupted: 'Start unterbrochen'
	};
	const backupsPending = $derived(Boolean(profile.ageIdentity && backupListing(profile) && backups === null));
	const typicalTotal = $derived(action ? STEPS[action].reduce((a, s) => a + typicalOf(s), 0) : 0);
	const elapsed = $derived(Math.max(0, (now - startedAt) / 1000));
	const share = $derived(typicalTotal ? Math.min(0.95, elapsed / typicalTotal) : 0);
	const leftMinutes = $derived(Math.max(1, Math.ceil((typicalTotal - elapsed) / 60)));
	const stepLabel = $derived(action ? (STEPS[action].find((s) => s.step === current)?.label ?? 'Vorbereiten') : '');
</script>

{#snippet fundOffer()}
	{@const locked = busy || purchaseLocked(buying)}
	{#if fromPackage}
		<div class="fund" data-testid="package-offer">
			<p class="hint">In deinem Paket liegen noch {packageHours} {packageHours === 1 ? 'Stunde' : 'Stunden'}. Le Space bezahlt die VM dann daraus; die Zahlweise wechselt auf „Le Space, aus meinem Paket“. Nichts wird gekauft.</p>
			<button onclick={startFromPackage} disabled={locked} data-testid="start-from-package">Aus dem Paket starten ({packageHours} h)</button>
		</div>
	{:else}
	<div class="fund" data-testid="fund-offer">
		<label>Stunden aus Le Space Credits kaufen
			<select bind:value={fundHours} disabled={locked} data-testid="fund-hours">{#each [5, 10, 30] as h (h)}<option value={h}>{h} h</option>{/each}</select></label>
		<button onclick={askToBuy} disabled={locked} data-testid="fund-start">{buying.phase === 'quoting' ? 'Preis wird abgefragt …' : 'Kaufen und starten'}</button>
	</div>
	<HourQuote quote={buying.phase === 'open' ? buying.quote : null} short={buying.phase === 'short'} hoursAsked={buying.hours} topUpHint="Erst Guthaben aufladen, unter „Aufladen, Stunden dazukaufen, Paket ändern“, dann noch einmal kaufen." confirmLabel="Kaufen und starten" disabled={busy || buying.phase === 'buying'} onconfirm={() => purchase.confirm()} oncancel={() => purchase.cancel()} />
	{#if buying.error}<p class="error" role="alert" data-testid="fund-error">{buying.error}</p>{/if}
	{/if}
{/snippet}

{#snippet gapWarning()}
	{#if gap}
		<div class="warn gap" data-testid="restore-gap">
			<p>
				{#if gap === 'missing'}Die letzte Sicherung, die diese App kennt ({known?.slice(-12)}{lastGood?.pieceCid === known && lastGood?.at ? `, vom ${new Date(lastGood.at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}), steht gerade nicht in der Liste der Sicherungen. Ein Start jetzt beginnt {chosenBackup ? 'mit einem anderen Stand' : 'ohne Daten'}.
				{:else}Die gewählte Sicherung ist älter als die letzte, die diese App kennt ({known?.slice(-12)}). Was danach dazukam, fehlt nach dem Start.{/if}
				Wenn du das nicht erwartest, versuche es später noch einmal.
			</p>
			<label><input type="checkbox" data-testid="restore-gap-accept" checked={!gapOpen} onchange={(e) => (gapAccepted = e.currentTarget.checked ? gapKey : '')} /> Trotzdem so starten</label>
		</div>
	{/if}
{/snippet}

<section class="lifecycle" class:simple data-testid="lifecycle">
	{#if simple}
		<div class="status is-{phase}" data-testid="simple-status">
			<span class="dot" aria-hidden="true"></span>
			<div>
				<h1>{TITLES[phase]}</h1>
				{#if phase === 'off'}<p class="sub">Der Start dauert etwa {minutes(STEPS.start.reduce((a, s) => a + typicalOf(s), 0))}.</p>
				{:else if phase === 'starting'}<p class="sub">Lass dieses Fenster offen, bis Paperless-ngx bereit ist.</p>
				{:else if phase === 'stopping'}<p class="sub">Erst die Sicherung, dann geht die Maschine aus. Lass dieses Fenster offen.</p>
				{:else if phase === 'running'}<p class="sub data">{profile.running.host}</p>
				{:else if phase === 'interrupted'}<p class="sub">Die Maschine läuft schon und kostet, bis sie fertig gestartet ist.</p>{/if}
				{#if profile.backupConfig}
					<!-- The answer people look for first: when the documents were last safe. -->
					<p class="good" class:stale={goodStale} data-testid="last-good-backup">{#if lastGood}{fromStop ? 'Letzte Sicherung beim Beenden' : 'Letzte erfolgreiche Sicherung'}: <strong>{goodWhen(lastGood.at)}</strong>{lastGood.copies ? ` · ${lastGood.copies} ${lastGood.copies === 1 ? 'Kopie' : 'Kopien'}` : ''}{#if newerOnChain}<br /><span data-testid="newer-on-chain">Auf Filecoin liegt eine neuere ({backups?.[0]?.copies.length} {backups?.[0]?.copies.length === 1 ? 'Kopie' : 'Kopien'}); ihre Uhrzeit meldet erst das neue Image.</span>{/if}{:else}Noch keine erfolgreiche Sicherung bekannt{/if}</p>
				{/if}
			</div>
		</div>

		{#if phase === 'starting' || phase === 'stopping'}
			<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(share * 100)} aria-label={TITLES[phase]}><span style="width: {Math.round(share * 100)}%"></span></div>
			<p class="calm" data-testid="simple-progress">{stepLabel} · noch etwa {leftMinutes} min</p>
		{:else if phase === 'running'}
			<a class="cta" href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="simple-open">Paperless-ngx öffnen</a>
			{#if profile.running.restore?.status === 'failed'}<p class="error">Die Sicherung ließ sich nicht wiederherstellen; Paperless-ngx läuft leer. Details unter „Erweitert“.</p>{/if}
			<div class="login" data-testid="simple-login">
				<p class="label">Anmeldung in Paperless-ngx</p>
				<p>Benutzer <code>admin</code></p>
				<p>Passwort {#if showPassword}<code data-testid="simple-password">{adminPassword}</code>{:else}<code>••••••••</code>{/if}</p>
				<div class="row">
					<button type="button" class="small" onclick={() => (showPassword = !showPassword)}>{showPassword ? 'Verbergen' : 'Passwort anzeigen'}</button>
					<button type="button" class="small" onclick={copyPassword}>Kopieren</button>
				</div>
			</div>
			{#if profile.backupConfig}<BackupNow {master} {profile} disabled={busy} onbusy={(b) => (backingUp = b)} ongood={rememberGood} />{/if}
			<button class="secondary" onclick={stop} disabled={busy || backingUp}>Sichern und beenden</button>
			<Storage {master} {profile} />
			{#if profile.ageIdentity && backupListing(profile)}<TrialRestore {master} {profile} listing={backupListing(profile)} onchange={async () => { profile = await loadProfile(master); onchange(); }} />{/if}
		{:else if phase === 'interrupted'}
			<button class="cta" onclick={resume} disabled={busy}>Start fortsetzen</button>
		{:else if phase === 'off'}
			{#if missing.length}
				<p class="hint">Paperless anywhere ist hier noch nicht fertig eingerichtet.</p>
				<button class="secondary" onclick={onadvanced}>Einrichtung öffnen</button>
			{:else}
				<button class="cta" onclick={start} disabled={busy || backupsPending || Boolean(backupsError) || gapOpen}>Paperless anywhere starten</button>
				{#if backupsPending}<p class="hint">Sicherungen werden gelesen …</p>
				{:else if backupsError}<p class="warn">{backupsError} Bitte gleich noch einmal versuchen.</p>
				{:else if profile.ageIdentity}<p class="hint" data-testid="simple-restore">{choice === 'latest' || choice === 'own' ? `Startet mit der neuesten Sicherung (${pick(choice === 'latest' ? backups ?? [] : split.own)?.pieceCid.slice(-12)}${whenOf(chosenBackup)}).` : 'Startet ohne Daten: es gibt noch keine eigene Sicherung.'}</p>{/if}
				{@render gapWarning()}
				<Storage {master} {profile} />
			{/if}
		{/if}
		{#if phase !== 'running' && profile.trial}<TrialRestore {master} {profile} listing={backupListing(profile)} onchange={async () => { profile = await loadProfile(master); onchange(); }} />{/if}
		{#if profile.backupRevokePending && !profile.running}<p class="hint" data-testid="revoke-pending">Der Schlüssel der gelöschten VM für die Sicherungen ist bei Le Space Credits noch freigegeben; die App versucht die Rücknahme beim nächsten Öffnen erneut.</p>{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if partial}
			<div class="partial" role="alert" data-testid="stop-partial">
				<p class="warn">{partial.message}</p>
				<p class="hint">Die angekommenen Kopien reichen zum Wiederherstellen. Wird die VM jetzt gelöscht, fehlt diese Sicherung bei {partial.requested - partial.copies === 1 ? 'einem Anbieter' : `${partial.requested - partial.copies} Anbietern`}. Bleibt sie, versucht die nächste Prüfung wieder alle.</p>
				<div class="row">
					<button onclick={eraseAnyway} disabled={busy} data-testid="stop-partial-erase">VM trotzdem löschen</button>
					<button class="secondary" onclick={keepVm} disabled={busy} data-testid="stop-partial-keep">VM behalten, Paperless-ngx weiter</button>
				</div>
			</div>
		{/if}
		{#if errorLog.length}<details class="log" data-testid="simple-backup-log"><summary>Details aus der VM</summary><pre>{errorLog.join('\n')}</pre><ProviderHealth network={profile.network ?? 'calibration'} ids={healthIds} /></details>{/if}
		{#if short && CREDITS_URL && (profile.appPays || profile.leSpacePays)}{@render fundOffer()}{/if}
		{#if bought}<p class="hint" role="status" data-testid="fund-bought">{bought}</p>{/if}
	{:else}
		<header class="head">
			<h2>Paperless-ngx</h2>
			<span class="chip" class:on={phase === 'running'} data-testid="paperless-chip">{CHIPS[phase]}</span>
		</header>
		<p class="purpose">Deine Paperless-ngx-Maschine: starten, öffnen, sichern und beenden.</p>
		{#if profile.running}
			<a class="cta" href={`https://${profile.running.host}/`} target="_blank" rel="noopener">Paperless-ngx öffnen</a>
			<p>Paperless-ngx läuft: <a href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="paperless-link">{profile.running.host}</a></p>
			{#if profile.running.restore?.status === 'failed'}<p class="error" data-testid="restore-failed">Wiederherstellung fehlgeschlagen ({profile.running.restore.reason ?? 'ohne Grund'}{profile.running.restore.error ? `: ${profile.running.restore.error}` : ''}). Paperless-ngx läuft leer. Diese VM nicht sichern, sondern unter „Meine VMs“ löschen: sonst wird die leere Paperless zur neuesten Sicherung.</p>{/if}
			{#if profile.running.dataDisk === 'encrypted'}<p class="hint" data-testid="data-disk">Was diese VM schreibt, liegt auf einer eigenen Platte, verschlüsselt mit einem Schlüssel, den nur die VM kennt.</p>
			{:else if profile.running.dataDisk === 'plain'}<p class="warn" data-testid="data-disk">Diese VM schreibt auf die gemeinsame Image-Platte, ohne eigenen Schlüssel. Die eigene Datenplatte ist vorerst ausgeschaltet (zu wenig Platz, bis die Container-Images flach sind).</p>{/if}
			<p data-testid="paperless-login">Anmeldung: <code>admin</code>,
				{#if showPassword}<code data-testid="admin-password">{adminPassword}</code>{:else}<span>••••••••</span>{/if}
				<button type="button" class="small" onclick={() => (showPassword = !showPassword)}>{showPassword ? 'Verbergen' : 'Passwort anzeigen'}</button>
				<button type="button" class="small" onclick={copyPassword}>Kopieren</button>
			</p>
			<button class="secondary" onclick={stop} disabled={busy}>Sichern und beenden</button>
		{:else}
			{#if profile.ageIdentity}
				<fieldset class="restore">
					<legend>Beim Start</legend>
					{#if production && backups?.length}
						<label><input type="radio" bind:group={choice} value="latest" data-testid="restore-latest" />
							Neueste Sicherung wiederherstellen
							<small data-testid="latest-backup">({pick(backups).pieceCid.slice(-12)}{whenOf(pick(backups))}{sizePart(pick(backups))}, {pick(backups).copies.length} Kopien: {wherePlaces(pick(backups))})</small>
						</label>
					{/if}
					<label><input type="radio" bind:group={choice} value="own" disabled={!split.own.length} />
						Neueste eigene Sicherung wiederherstellen
						{#if split.own.length}<small data-testid="newest-backup">({pick(split.own).pieceCid.slice(-12)}{whenOf(pick(split.own))}{sizePart(pick(split.own))}, {pick(split.own).copies.length} Kopien: {wherePlaces(pick(split.own))})</small>
						{:else if backups}<small>(dieser Tresor hat noch keine gemacht)</small>{:else}<small>(lese …)</small>{/if}
					</label>
					{#if split.other.length}
						<label><input type="radio" bind:group={choice} value="any" />
							Neueste andere Sicherung des Kontos ({pick(split.other).pieceCid.slice(-12)}{sizePart(pick(split.other))}, {wherePlaces(pick(split.other))})
							<small>– nicht von diesem Tresor ({split.other.length}); nur wenn sie mit deinem Schlüssel verschlüsselt ist, z. B. vom Mac mit eingefügtem Schlüssel</small>
						</label>
					{/if}
					<label><input type="radio" bind:group={choice} value="empty" /> Leeres Paperless-ngx</label>
					{#if backupsError}<small class="hint">{backupsError}</small>{/if}
				</fieldset>
				{@render gapWarning()}
			{/if}
			{#if profile.starting && !busy}
				<div class="interrupted" data-testid="start-interrupted">
					<p>Ein Start wurde unterbrochen: VM <code>{profile.starting.instanceHash.slice(0, 12)}</code>, angefordert {new Date(profile.starting.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}. Sie läuft auf Aleph und kostet, bis sie fertig gestartet oder gelöscht ist.</p>
					<button class="cta" onclick={resume} disabled={busy}>Start fortsetzen</button>
					<button class="quiet" onclick={discard} disabled={busy}>Verwerfen (die VM dann unten unter „Meine VMs“ löschen)</button>
				</div>
			{:else}
				<p class="role-line" data-testid="role-line">{profile.role === 'primary' ? 'Startet produktiv: Mail-Regeln an, Sicherungen auf Mainnet.' : 'Startet als Test: Mail-Regeln aus, Sicherungen ins Testnetz.'}</p>
				<button class="cta" onclick={start} disabled={busy || missing.length > 0 || gapOpen}>Paperless anywhere starten</button>
				{#if missing.length}<p class="hint">Es fehlt noch: {missing.join(', ')}</p>{/if}
			{/if}
		{/if}
		{#if action && (busy || Object.keys(times).length)}
			<ol class="steps" data-testid="progress-steps">
				{#each STEPS[action] as s (s.step)}
					{@const t = times[s.step]}
					<li class:done={t?.to} class:active={t && !t.to}>
						<span class="mark">{t?.to ? '✓' : t ? '▶' : '·'}</span>
						{s.label}
						<small>
							{#if t}{seconds((t.to ?? now) - t.from)}{/if}
							(üblich ca. {minutes(typicalOf(s))})
						</small>
						{#if s.step === 'ready' && t}
							{#if vmStart?.timeline}
								<ul class="substeps" data-testid="vm-substeps">
									{#each SUBSTEPS as sub (sub.key)}
										{@const at = vmStart.timeline[sub.key]}
										<li class:done={at}>
											<span class="mark">{at ? '✓' : '·'}</span>{sub.label}
											{#if sub.key === 'images' && vmStart.imagesTotal}<small>{vmStart.images}/{vmStart.imagesTotal}</small>{/if}
											{#if at}<small>nach {at - vmStart.timeline.unlocked} s</small>{/if}
										</li>
									{/each}
								</ul>
							{:else if !t.to}
								<p class="hint">Die Status-Seite der VM antwortet erst, wenn ihr Zertifikat da ist. Bis dahin lädt sie die Container-Images (der längste Teil); die Einzelschritte erscheinen dann hier.</p>
							{/if}
						{/if}
					</li>
				{/each}
			</ol>
			<p class="hint">Gesamt: {seconds((busy ? now : Object.values(times).reduce((m, t) => Math.max(m, t.to ?? 0), startedAt)) - startedAt)}
				· üblich ca. {minutes(STEPS[action].reduce((a, s) => a + typicalOf(s), 0))}</p>
		{/if}
		{#if progress}<p data-testid="progress">{progress} …</p>{/if}
		{#if profile.backupRevokePending && !profile.running}<p class="hint" data-testid="revoke-pending">Der Schlüssel der gelöschten VM für die Sicherungen ist bei Le Space Credits noch freigegeben; die App versucht die Rücknahme beim nächsten Öffnen erneut.</p>{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if partial}
			<div class="partial" role="alert" data-testid="stop-partial">
				<p class="warn">{partial.message}</p>
				<p class="hint">Die angekommenen Kopien reichen zum Wiederherstellen. Wird die VM jetzt gelöscht, fehlt diese Sicherung bei {partial.requested - partial.copies === 1 ? 'einem Anbieter' : `${partial.requested - partial.copies} Anbietern`}. Bleibt sie, versucht die nächste Prüfung wieder alle.</p>
				<div class="row">
					<button onclick={eraseAnyway} disabled={busy} data-testid="stop-partial-erase">VM trotzdem löschen</button>
					<button class="secondary" onclick={keepVm} disabled={busy} data-testid="stop-partial-keep">VM behalten, Paperless-ngx weiter</button>
				</div>
			</div>
		{/if}
		{#if short && CREDITS_URL && profile.appPays}{@render fundOffer()}{/if}
		{#if bought}<p class="hint" role="status" data-testid="fund-bought">{bought}</p>{/if}
		{#if errorLog.length}
			<details open class="log"><summary>Was die VM zur Sicherung meldet</summary><pre data-testid="backup-log">{errorLog.join('\n')}</pre><ProviderHealth network={profile.network ?? 'calibration'} ids={healthIds} /></details>
		{/if}
		{#if !profile.running && profile.lastBackup}
			{@const b = profile.lastBackup}
			<details class="backup-card" data-testid="last-backup">
				<summary>Letzte Sicherung: {b.date ? new Date(b.date).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : b.name} · {b.copies?.length ?? 0}/{b.requestedCopies ?? b.copies?.length} Kopien{b.complete ? '' : ' (unvollständig)'}</summary>
				<dl>
					<dt>Netz</dt><dd>Filecoin {b.network === 'mainnet' ? 'Mainnet' : 'Calibration (Testnetz)'}</dd>
					<dt>Bezahlt von</dt><dd><code>{b.payer}</code></dd>
					<dt>Piece CID</dt><dd><code>{b.pieceCid}</code></dd>
					{#if b.size}<dt>Größe</dt><dd>{(b.size / 1048576).toFixed(1)} MiB (verschlüsselt){b.parts?.length > 1 ? `, in ${b.parts.length} Teilen` : ''}</dd>{/if}
					{#if b.seconds}<dt>Dauer</dt><dd>{b.seconds} s</dd>{/if}
				</dl>
				<ul>
					{#each b.copies ?? [] as c (c.providerId + c.dataSetId)}
						<li>Anbieter {c.providerId}{c.location ? ` (${place(c.location)})` : ''} · Datensatz {c.dataSetId}, Piece {c.pieceId}{c.isNewDataSet ? ' (neuer Datensatz)' : ''}
							{#if c.retrievalUrl}<br /><a href={c.retrievalUrl} target="_blank" rel="noopener">abrufen</a> <small>(verschlüsselt; nur dein Schlüssel öffnet sie)</small>{/if}</li>
					{/each}
				</ul>
				{#if b.failedAttempts}<p class="hint">{b.failedAttempts} Fehlversuch(e) bei Anbietern, ersetzt.</p>{/if}
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
	.login { margin: 1rem 0 0; padding: 0.9rem 1rem; background: var(--surface-2); border-radius: var(--radius-sm); }
	.login p { margin: 0.15rem 0; }
	.login .label { color: var(--text-2); font-size: 0.85rem; margin-bottom: 0.35rem; }
	.login code { word-break: break-all; }
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
	.steps { list-style: none; padding: 0; margin: 0.75rem 0; }
	.steps li { padding: 0.15rem 0; color: var(--text-2); }
	.steps li.active { color: var(--text); font-weight: 600; }
	.steps li.done { color: var(--ok); }
	.steps .mark { display: inline-block; width: 1.2rem; }
	.substeps { list-style: none; padding-left: 1.6rem; margin: 0.2rem 0; font-weight: normal; }
	.substeps li { color: var(--text-2); }
	.substeps li.done { color: var(--ok); }
	.steps small { color: var(--text-2); font-weight: normal; margin-left: 0.4rem; }
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
</style>
