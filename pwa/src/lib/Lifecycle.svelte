<script>
	import { loadProfile, saveProfile } from '$lib/profile.js';
	import { startPaperless, startRequirements, stopPaperless } from '$lib/lifecycle.js';
	import { listBackups, pieceCidOfStop, restoreEntry, splitOwn } from '$lib/backups.js';
	import { paperlessSecrets } from '$lib/keys/derive.js';

	/** @type {{ master: Uint8Array, version?: number, onchange?: () => void }} */
	let { master, version = 0, onchange = () => {} } = $props();

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
			{ step: 'stop', label: 'Stopp anfordern (letzte Sicherung)', typical: 10 },
			{ step: 'forget', label: 'VM löschen', typical: 5 }
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
		return (/** @type {{ step: string, detail?: string, status?: any }} */ { step, detail, status }) => {
			progress = detail ?? step;
			if (status?.start) vmStart = status.start;
			if (step !== current) {
				if (current && times[current]) times[current].to = Date.now();
				times[step] = { from: Date.now() };
				current = step;
			}
		};
	};
	const seconds = (ms) => `${Math.max(0, Math.round(ms / 1000))} s`;
	const minutes = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);
	let error = $state('');
	let busy = $state(false);
	/** @type {any[] | null} */
	let backups = $state(null);
	let backupsError = $state('');
	// Only this vault's own backups are offered by default: the test data sets
	// also hold backups encrypted to other keys (round trips), which this vault
	// cannot decrypt (live: "age could not decrypt the piece").
	let choice = $state('empty');
	const split = $derived(splitOwn(backups ?? [], profile.ownBackups ?? []));
	const pick = (list) => list.find((b) => b.complete) ?? list[0];
	// The admin password is derived from the master secret; it is shown only on request.
	let showPassword = $state(false);
	const adminPassword = $derived(paperlessSecrets(master).adminPassword);
	const copyPassword = () => navigator.clipboard?.writeText(adminPassword);

	const reload = async () => {
		profile = await loadProfile(master);
		const owner = profile.backupOwner || profile.payer;
		if (owner && profile.ageIdentity && !profile.running) {
			backupsError = '';
			listBackups({ network: profile.network ?? 'calibration', owner })
				.then((list) => ((backups = list), (choice = splitOwn(list, profile.ownBackups ?? []).own.length ? 'own' : 'empty')))
				.catch(() => ((backups = []), (backupsError = 'Die Sicherungen ließen sich gerade nicht lesen.')));
		}
	};
	// Again whenever the setup saved something (`version` changes).
	$effect(() => {
		version;
		reload().catch((e) => (error = e.message));
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
			progress = '';
			clearInterval(ticker);
			if (current && times[current] && !times[current].to) times[current].to = Date.now();
		}
	}

	const start = () => run(async () => {
		await reload();
		const chosen = choice === 'own' ? pick(split.own) : choice === 'any' ? pick(backups ?? []) : null;
		const forStart = { ...$state.snapshot(profile), restoreEntry: chosen ? restoreEntry(chosen) : null };
		const running = await startPaperless(master, forStart, track('start'));
		profile = { ...profile, running };
		await saveProfile(master, $state.snapshot(profile));
		onchange();
	});
	const stop = () => run(async () => {
		await reload();
		const status = await stopPaperless(master, $state.snapshot(profile), track('stop'));
		const { running, ...rest } = profile;
		const made = pieceCidOfStop(status);
		profile = made ? { ...rest, ownBackups: [made, ...(rest.ownBackups ?? []).filter((c) => c !== made)].slice(0, 50) } : rest;
		await saveProfile(master, $state.snapshot(profile));
		onchange();
	});
	const missing = $derived(startRequirements(profile));
</script>

<section class="lifecycle" data-testid="lifecycle">
	{#if profile.running}
		<p>Paperless läuft: <a href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="paperless-link">{profile.running.host}</a></p>
		{#if profile.running.restore?.status === 'failed'}<p class="error" data-testid="restore-failed">Wiederherstellung fehlgeschlagen ({profile.running.restore.reason ?? 'ohne Grund'}). Paperless läuft leer.</p>{/if}
		<p data-testid="paperless-login">Anmeldung: <code>admin</code>,
			{#if showPassword}<code data-testid="admin-password">{adminPassword}</code>{:else}<span>••••••••</span>{/if}
			<button type="button" onclick={() => (showPassword = !showPassword)}>{showPassword ? 'Verbergen' : 'Passwort anzeigen'}</button>
			<button type="button" onclick={copyPassword}>Kopieren</button>
		</p>
		<button onclick={stop} disabled={busy}>Sichern und stoppen</button>
	{:else}
		{#if profile.ageIdentity}
			<fieldset class="restore">
				<legend>Beim Start</legend>
				<label><input type="radio" bind:group={choice} value="own" disabled={!split.own.length} />
					Neueste eigene Sicherung wiederherstellen
					{#if split.own.length}<small data-testid="newest-backup">({pick(split.own).pieceCid.slice(-12)}, {pick(split.own).copies.length} Kopien)</small>
					{:else if backups}<small>(dieser Tresor hat noch keine gemacht)</small>{:else}<small>(lese …)</small>{/if}
				</label>
				{#if split.other.length}
					<label><input type="radio" bind:group={choice} value="any" />
						Neueste Sicherung des Kontos ({pick(backups ?? []).pieceCid.slice(-12)})
						<small>– nur wenn sie mit deinem Schlüssel verschlüsselt ist, z. B. vom Mac mit eingefügtem Schlüssel; {split.other.length} stammen nicht von diesem Tresor</small>
					</label>
				{/if}
				<label><input type="radio" bind:group={choice} value="empty" /> Leeres Paperless</label>
				{#if backupsError}<small class="hint">{backupsError}</small>{/if}
			</fieldset>
		{/if}
		<button onclick={start} disabled={busy || missing.length > 0}>Paperless starten</button>
		{#if missing.length}<p class="hint">Es fehlt noch: {missing.join(', ')}</p>{/if}
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
						(üblich ca. {minutes(s.typical)})
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
			· üblich ca. {minutes(STEPS[action].reduce((a, s) => a + s.typical, 0))}</p>
	{/if}
	{#if progress}<p data-testid="progress">{progress} …</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.steps { list-style: none; padding: 0; margin: 0.75rem 0; }
	.steps li { padding: 0.15rem 0; color: #888; }
	.steps li.active { color: #000; font-weight: 600; }
	.steps li.done { color: #2e7d32; }
	.steps .mark { display: inline-block; width: 1.2rem; }
	.substeps { list-style: none; padding-left: 1.6rem; margin: 0.2rem 0; font-weight: normal; }
	.substeps li { color: #888; }
	.substeps li.done { color: #2e7d32; }
	.steps small { color: #666; font-weight: normal; margin-left: 0.4rem; }
	.lifecycle { margin: 1.5rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 0.5rem; }
	button { padding: 0.6rem 1rem; font-size: 1rem; }
	.hint { color: #666; }
	.restore { border: none; padding: 0; margin: 0 0 0.75rem; }
	.restore label { display: block; }
	.error { color: #b00020; }
</style>
