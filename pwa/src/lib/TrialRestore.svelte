<script>
	// Check a backup without touching the running Paperless: a second VM
	// restored from the newest backup, as a test (mail rules off, no backups of
	// its own, its own address), to look at and then end without a backup.
	import { updateProfile } from '$lib/profile.js';
	import { endTrial, startTrial } from '$lib/lifecycle.js';
	import { listBackups, restoreEntry } from '$lib/backups.js';
	import { creditsBalance } from '$lib/credits.js';
	import { paperlessSecrets } from '$lib/keys/derive.js';

	/** @type {{ master: Uint8Array, profile: Record<string, any>, listing: { owner: string, customer?: string, label?: string } | null, onchange?: () => void }} */
	let { master, profile, listing, onchange = () => {} } = $props();

	let busy = $state(false);
	let step = $state('');
	let error = $state('');
	const trial = $derived(profile.trial ?? null);
	const adminPassword = $derived(paperlessSecrets(master).adminPassword);
	let showPassword = $state(false);

	async function start() {
		if (!confirm('Eine zweite Paperless-ngx-Instanz mit der neuesten Sicherung starten? Sie läuft neben der jetzigen, ohne Mails und ohne eigene Sicherungen, und kostet Rechenzeit wie die laufende Instanz, bis du sie beendest.')) return;
		busy = true;
		error = '';
		step = 'Sicherungen lesen';
		try {
			if (!listing) throw new Error('Es ist nicht eingerichtet, wo die Sicherungen liegen.');
			// Through Le Space Credits, the data sets the service lists for this account.
			const ids = profile.backupsByCredits && !profile.backupOwner ? (await creditsBalance(master).catch(() => null))?.backup?.dataSets : undefined;
			const list = await listBackups({ network: profile.network ?? 'calibration', ...listing, ...(ids ? { dataSetIds: ids } : {}) });
			const newest = list[0];
			if (!newest) throw new Error('Es gibt noch keine Sicherung zum Prüfen.');
			const entry = restoreEntry(newest);
			const run = await startTrial(master, $state.snapshot(profile), entry, ({ detail, step: s }) => (step = detail ?? s), {
				onRequested: async (starting) => {
					await updateProfile(master, (p) => ({ ...p, trial: { ...starting, backup: newest.pieceCid } }));
					onchange();
				}
			});
			await updateProfile(master, (p) => ({ ...p, trial: { ...(p.trial ?? {}), ...run, backup: newest.pieceCid, readyAt: Date.now() } }));
			onchange();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
			step = '';
		}
	}

	async function end() {
		if (!confirm('Die Probe beenden? Die zweite VM wird ohne Sicherung gelöscht; was du dort geändert hast, ist dann weg. Die laufende Instanz bleibt.')) return;
		busy = true;
		error = '';
		step = 'Probe-VM löschen';
		try {
			await endTrial(master, $state.snapshot(trial), $state.snapshot(profile));
			await updateProfile(master, ({ trial: _gone, ...rest }) => rest);
			onchange();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
			step = '';
		}
	}
	const docs = $derived(trial?.restore?.documents);
</script>

<div class="trial" data-testid="trial">
	<p class="label">Sicherung prüfen</p>
	{#if !trial}
		<p class="hint">Startet eine zweite Paperless-ngx-Instanz aus der neuesten Sicherung, neben der laufenden: ohne Mail-Abruf, ohne eigene Sicherungen, mit eigener Adresse. Dort siehst du nach, ob alles da ist, und beendest sie dann.</p>
		<button type="button" class="small" onclick={start} disabled={busy} data-testid="trial-start">Probe aus der neuesten Sicherung starten</button>
	{:else if !trial.host}
		<p class="hint">Die Probe-VM wurde angefordert, ist aber nicht fertig gestartet{busy ? '' : ' (Start unterbrochen)'}.</p>
		{#if !busy}<button type="button" class="small" onclick={end} data-testid="trial-end">Probe beenden</button>{/if}
	{:else}
		<p>Probe läuft, aus Sicherung <code>…{String(trial.backup ?? '').slice(-12)}</code>{#if trial.restore?.status === 'done'}: <strong class="ok">wiederhergestellt{docs != null ? `, ${docs} Dokumente` : ''}</strong>{:else if trial.restore?.status === 'failed'}: <strong class="bad">Wiederherstellung fehlgeschlagen{trial.restore.reason ? ` (${trial.restore.reason})` : ''}</strong>{/if}</p>
		<a class="open" href={`https://${trial.host}/`} target="_blank" rel="noopener" data-testid="trial-open">Probe öffnen</a>
		<p class="hint">Anmeldung wie bei deiner Paperless-ngx-Instanz: <code>admin</code>, Passwort {#if showPassword}<code>{adminPassword}</code>{:else}<button type="button" class="link" onclick={() => (showPassword = true)}>anzeigen</button>{/if}</p>
		<button type="button" class="small" onclick={end} disabled={busy} data-testid="trial-end">Probe beenden (ohne Sicherung)</button>
	{/if}
	{#if busy && step}<p class="hint" role="status">{step} …</p>{/if}
	{#if error}<p class="bad" role="alert">{error}</p>{/if}
</div>

<style>
	.trial { margin: 0.75rem 0 0; padding: 0.9rem 1rem; background: var(--surface-2); border-radius: var(--radius-sm); }
	.trial p { margin: 0.2rem 0; }
	.label { color: var(--text-2); font-size: 0.85rem; margin-bottom: 0.35rem; }
	.hint { color: var(--text-2); font-size: 0.875rem; }
	.ok { color: var(--ok); }
	.bad { color: var(--danger); }
	.open { display: inline-block; margin: 0.4rem 0; font-weight: 600; }
	.small { margin-top: 0.5rem; padding: 0.35rem 0.85rem; font-size: 0.875rem; background: var(--surface); color: var(--text); border-color: var(--line); }
	.link { background: none; border: none; padding: 0; color: var(--accent-text); text-decoration: underline; cursor: pointer; font-size: inherit; }
	code { word-break: break-all; }
</style>
