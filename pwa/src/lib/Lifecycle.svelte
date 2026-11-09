<script>
	import { backupListing, loadProfile, updateProfile } from '$lib/profile.js';
	import { AlephShortError, BackupPartialError, eraseStopped, resumeAfterPartial, resumeStart, retryBackupRevoke, startPaperless, startRequirements, stopPaperless } from '$lib/lifecycle.js';
	import { vmStatus } from '$lib/vm.js';
	import Storage from '$lib/Storage.svelte';
	import { statusToken } from '$lib/keys/derive.js';
	import { CREDITS_URL, creditsBalance, fundVm, vmAuthorize } from '$lib/credits.js';
	import { isAuthorized, readAuthorizations } from '$lib/permissions.js';
	import { alephBalance } from '$lib/balances.js';
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import { listBackups, pieceCidOfStop, place, restoreEntry, splitOwn } from '$lib/backups.js';
	import { paperlessSecrets } from '$lib/keys/derive.js';
	import { startingInstance } from '$lib/starting.js';
	import BackupNow from '$lib/BackupNow.svelte';
	import TrialRestore from '$lib/TrialRestore.svelte';
	import ProviderHealth from '$lib/ProviderHealth.svelte';
	import { providerIdsIn } from '$lib/providers.js';

	/** @type {{ master: Uint8Array, simple?: boolean, version?: number, onchange?: () => void, onadvanced?: () => void, onmissing?: (missing: string[]) => void }} */
	let { master, simple = false, version = 0, onchange = () => {}, onadvanced = () => {}, onmissing = () => {} } = $props();

	/** @type {Record<string, any>} */
	let profile = $state({});
	let progress = $state('');
	// The steps of a start and a stop, with what they took in our runs so far
	// (start: 336-399 s from click to ready in the live tests of 2026-10-22).
	const STEPS = {
		start: [
			{ step: 'measure', label: 'Messwerte berechnen', typical: 5 },
			{ step: 'instance', label: 'VM anfordern und platzieren', typical: 20 },
			{ step: 'network', label: 'Port 443 und Adresse', typical: 20 },
			{ step: 'unlock', label: 'VM prüfen (AMD) und entsperren', typical: 10 },
			{ step: 'ready', label: 'Paperless startet (Container, Zertifikat)', typical: 300 }
		],
		stop: [
			// With backups on, the stop waits for one: export, encryption, upload
			// to two providers and their confirmation on chain (about 6-8 min,
			// mostly fixed costs). Erasing waits for the node to confirm.
			{ step: 'stop', label: 'Stopp anfordern (letzte Sicherung)', typical: 10, typicalWithBackup: 420 },
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
		{ key: 'paperless', label: 'Paperless antwortet' }
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
	const typicalOf = (s) => (profile.backupConfig && s.typicalWithBackup ? s.typicalWithBackup : s.typical);
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
	const wherePlaces = (b) => b.copies.map((c) => c.place || `Anbieter ${c.providerId}`).join(' und ');
	// The admin password is derived from the master secret; it is shown only on request.
	let showPassword = $state(false);
	const adminPassword = $derived(paperlessSecrets(master).adminPassword);
	const copyPassword = () => navigator.clipboard?.writeText(adminPassword);

	let loaded = $state(false);
	/** A revoke of the backup key retried in the background; a start waits for it. */
	let revoking = Promise.resolve();
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
		// Through Le Space Credits, the service lists this account's data sets;
		// without its answer, the payer's are filtered by label and tag alone.
		const listing = backupListing(profile, profile.backupsByCredits && profile.backupSigner ? ((await creditsBalance(master).catch(() => null))?.backup ?? null) : null);
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
	async function run(fn) {
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
		const chosen = choice === 'latest' ? pick(backups ?? []) : choice === 'own' ? pick(split.own) : choice === 'any' ? pick(split.other) : null;
		const forStart = { ...$state.snapshot(profile), restoreEntry: chosen ? restoreEntry(chosen) : null };
		// Once Aleph has the VM, the profile knows it: a reload carries on from there.
		const onRequested = async (starting) => {
			profile = await updateProfile(master, (now) => ({ ...now, starting }));
			onchange();
		};
		await finishStart(() => startPaperless(master, forStart, track('start'), { onRequested }));
	}
	// Buy hours from Le Space Credits: the service grants them (with Aleph's
	// start reserve) to the app's address; once Aleph shows them, start.
	const fundAndStart = () => run(async () => {
		const need = short?.reserve ?? 0;
		progress = 'Le Space Credits: Stunden für Aleph holen';
		await fundVm(master, fundHours);
		progress = 'Warte, bis Aleph die Gutschrift zeigt';
		const app = privateKeyToAccount(alephPrivateKey(master)).address;
		// The account that pays: the app's own, or Le Space's for this customer (model A).
		const payerAccount = profile.leSpacePays ? (profile.vmOwner ?? app) : app;
		for (let i = 0; i < 36; i++) {
			const b = await alephBalance(payerAccount).catch(() => null);
			if (b && b.credits >= need) break;
			if (i === 35) throw new Error('Die Gutschrift ist bei Aleph noch nicht zu sehen. In ein paar Minuten noch einmal starten.');
			await new Promise((res) => setTimeout(res, 5000));
		}
		onchange();
		await startNow();
	});
	const resume = () => run(async () => {
		await reload();
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
		progress = 'Paperless wieder starten';
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
	const TITLES = {
		loading: 'Einen Moment …',
		off: 'Paperless ist aus',
		starting: 'Paperless startet',
		stopping: 'Paperless wird gesichert und beendet',
		running: 'Paperless läuft',
		interrupted: 'Start unterbrochen'
	};
	const backupsPending = $derived(Boolean(profile.ageIdentity && backupListing(profile) && backups === null));
	const typicalTotal = $derived(action ? STEPS[action].reduce((a, s) => a + typicalOf(s), 0) : 0);
	const elapsed = $derived(Math.max(0, (now - startedAt) / 1000));
	const share = $derived(typicalTotal ? Math.min(0.95, elapsed / typicalTotal) : 0);
	const leftMinutes = $derived(Math.max(1, Math.ceil((typicalTotal - elapsed) / 60)));
	const stepLabel = $derived(action ? (STEPS[action].find((s) => s.step === current)?.label ?? 'Vorbereiten') : '');
</script>

<section class="lifecycle" class:simple data-testid="lifecycle">
	{#if simple}
		<div class="status is-{phase}" data-testid="simple-status">
			<span class="dot" aria-hidden="true"></span>
			<div>
				<h1>{TITLES[phase]}</h1>
				{#if phase === 'off'}<p class="sub">Der Start dauert etwa {minutes(STEPS.start.reduce((a, s) => a + typicalOf(s), 0))}.</p>
				{:else if phase === 'starting'}<p class="sub">Lass dieses Fenster offen, bis Paperless bereit ist.</p>
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
			<a class="cta" href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="simple-open">Paperless öffnen</a>
			{#if profile.running.restore?.status === 'failed'}<p class="error">Die Sicherung ließ sich nicht wiederherstellen; Paperless läuft leer. Details unter „Erweitert“.</p>{/if}
			<div class="login" data-testid="simple-login">
				<p class="label">Anmeldung in Paperless</p>
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
				<p class="hint">Paperless ist hier noch nicht fertig eingerichtet.</p>
				<button class="secondary" onclick={onadvanced}>Einrichtung öffnen</button>
			{:else}
				<button class="cta" onclick={start} disabled={busy || backupsPending || Boolean(backupsError)}>Paperless starten</button>
				{#if backupsPending}<p class="hint">Sicherungen werden gelesen …</p>
				{:else if backupsError}<p class="warn">{backupsError} Bitte gleich noch einmal versuchen.</p>
				{:else if profile.ageIdentity}<p class="hint" data-testid="simple-restore">{choice === 'latest' || choice === 'own' ? `Startet mit der neuesten Sicherung (${pick(choice === 'latest' ? backups ?? [] : split.own)?.pieceCid.slice(-12)}).` : 'Startet ohne Daten: es gibt noch keine eigene Sicherung.'}</p>{/if}
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
					<button class="secondary" onclick={keepVm} disabled={busy} data-testid="stop-partial-keep">VM behalten, Paperless weiter</button>
				</div>
			</div>
		{/if}
		{#if errorLog.length}<details class="log" data-testid="simple-backup-log"><summary>Details aus der VM</summary><pre>{errorLog.join('\n')}</pre><ProviderHealth network={profile.network ?? 'calibration'} ids={healthIds} /></details>{/if}
		{#if short && CREDITS_URL && (profile.appPays || profile.leSpacePays)}
			<div class="fund" data-testid="fund-offer">
				<label>Stunden aus Le Space Credits holen
					<select bind:value={fundHours} data-testid="fund-hours">{#each [5, 10, 30] as h (h)}<option value={h}>{h} h</option>{/each}</select></label>
				<button onclick={fundAndStart} disabled={busy} data-testid="fund-start">Holen und starten</button>
			</div>
		{/if}
	{:else}
		{#if profile.running}
			<p>Paperless läuft: <a href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="paperless-link">{profile.running.host}</a></p>
			{#if profile.running.restore?.status === 'failed'}<p class="error" data-testid="restore-failed">Wiederherstellung fehlgeschlagen ({profile.running.restore.reason ?? 'ohne Grund'}{profile.running.restore.error ? `: ${profile.running.restore.error}` : ''}). Paperless läuft leer. Diese VM nicht sichern, sondern unter „Meine VMs“ löschen: sonst wird die leere Paperless zur neuesten Sicherung.</p>{/if}
			{#if profile.running.dataDisk === 'encrypted'}<p class="hint" data-testid="data-disk">Was diese VM schreibt, liegt auf einer eigenen Platte, verschlüsselt mit einem Schlüssel, den nur die VM kennt.</p>
			{:else if profile.running.dataDisk === 'plain'}<p class="warn" data-testid="data-disk">Diese VM schreibt auf die gemeinsame Image-Platte, ohne eigenen Schlüssel. Die eigene Datenplatte ist vorerst ausgeschaltet (zu wenig Platz, bis die Container-Images flach sind).</p>{/if}
			<p data-testid="paperless-login">Anmeldung: <code>admin</code>,
				{#if showPassword}<code data-testid="admin-password">{adminPassword}</code>{:else}<span>••••••••</span>{/if}
				<button type="button" onclick={() => (showPassword = !showPassword)}>{showPassword ? 'Verbergen' : 'Passwort anzeigen'}</button>
				<button type="button" onclick={copyPassword}>Kopieren</button>
			</p>
			<button onclick={stop} disabled={busy}>Sichern und beenden</button>
		{:else}
			{#if profile.ageIdentity}
				<fieldset class="restore">
					<legend>Beim Start</legend>
					{#if production && backups?.length}
						<label><input type="radio" bind:group={choice} value="latest" data-testid="restore-latest" />
							Neueste Sicherung wiederherstellen
							<small data-testid="latest-backup">({pick(backups).pieceCid.slice(-12)}, {pick(backups).copies.length} Kopien: {wherePlaces(pick(backups))})</small>
						</label>
					{/if}
					<label><input type="radio" bind:group={choice} value="own" disabled={!split.own.length} />
						Neueste eigene Sicherung wiederherstellen
						{#if split.own.length}<small data-testid="newest-backup">({pick(split.own).pieceCid.slice(-12)}, {pick(split.own).copies.length} Kopien: {wherePlaces(pick(split.own))})</small>
						{:else if backups}<small>(dieser Tresor hat noch keine gemacht)</small>{:else}<small>(lese …)</small>{/if}
					</label>
					{#if split.other.length}
						<label><input type="radio" bind:group={choice} value="any" />
							Neueste andere Sicherung des Kontos ({pick(split.other).pieceCid.slice(-12)}, {wherePlaces(pick(split.other))})
							<small>– nicht von diesem Tresor ({split.other.length}); nur wenn sie mit deinem Schlüssel verschlüsselt ist, z. B. vom Mac mit eingefügtem Schlüssel</small>
						</label>
					{/if}
					<label><input type="radio" bind:group={choice} value="empty" /> Leeres Paperless</label>
					{#if backupsError}<small class="hint">{backupsError}</small>{/if}
				</fieldset>
			{/if}
			{#if profile.starting && !busy}
				<div class="interrupted" data-testid="start-interrupted">
					<p>Ein Start wurde unterbrochen: VM <code>{profile.starting.instanceHash.slice(0, 12)}</code>, angefordert {new Date(profile.starting.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}. Sie läuft auf Aleph und kostet, bis sie fertig gestartet oder gelöscht ist.</p>
					<button onclick={resume} disabled={busy}>Start fortsetzen</button>
					<button class="quiet" onclick={discard} disabled={busy}>Verwerfen (die VM dann unten unter „Meine VMs“ löschen)</button>
				</div>
			{:else}
				<p class="role-line" data-testid="role-line">{profile.role === 'primary' ? 'Startet produktiv: Mail-Regeln an, Sicherungen auf Mainnet.' : 'Startet als Test: Mail-Regeln aus, Sicherungen ins Testnetz.'}</p>
				<button onclick={start} disabled={busy || missing.length > 0}>Paperless starten</button>
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
					<button class="secondary" onclick={keepVm} disabled={busy} data-testid="stop-partial-keep">VM behalten, Paperless weiter</button>
				</div>
			</div>
		{/if}
		{#if short && CREDITS_URL && profile.appPays}
			<div class="fund" data-testid="fund-offer">
				<label>Stunden aus Le Space Credits holen
					<select bind:value={fundHours} data-testid="fund-hours">{#each [5, 10, 30] as h (h)}<option value={h}>{h} h</option>{/each}</select></label>
				<button onclick={fundAndStart} disabled={busy} data-testid="fund-start">Holen und starten</button>
			</div>
		{/if}
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
					{#if b.size}<dt>Größe</dt><dd>{(b.size / 1048576).toFixed(1)} MiB (verschlüsselt)</dd>{/if}
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
