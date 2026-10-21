<script>
	import { loadProfile, saveProfile } from '$lib/profile.js';
	import { startPaperless, startRequirements, stopPaperless } from '$lib/lifecycle.js';
	import { listBackups, restoreEntry } from '$lib/backups.js';

	/** @type {{ master: Uint8Array, version?: number }} */
	let { master, version = 0 } = $props();

	/** @type {Record<string, any>} */
	let profile = $state({});
	let progress = $state('');
	let error = $state('');
	let busy = $state(false);
	/** @type {any[] | null} */
	let backups = $state(null);
	let backupsError = $state('');
	let choice = $state('newest');

	const reload = async () => {
		profile = await loadProfile(master);
		const owner = profile.backupOwner || profile.payer;
		if (owner && profile.ageIdentity && !profile.running) {
			backupsError = '';
			listBackups({ network: profile.network ?? 'calibration', owner })
				.then((list) => (backups = list))
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
		}
	}

	const start = () => run(async () => {
		await reload();
		const chosen = choice === 'newest' ? backups?.find((b) => b.complete) ?? backups?.[0] : null;
		const forStart = { ...$state.snapshot(profile), restoreEntry: chosen ? restoreEntry(chosen) : null };
		const running = await startPaperless(master, forStart, ({ detail, step }) => (progress = detail ?? step));
		profile = { ...profile, running };
		await saveProfile(master, $state.snapshot(profile));
	});
	const stop = () => run(async () => {
		await reload();
		await stopPaperless(master, $state.snapshot(profile), ({ detail, step }) => (progress = detail ?? step));
		const { running, ...rest } = profile;
		profile = rest;
		await saveProfile(master, $state.snapshot(profile));
	});
	const missing = $derived(startRequirements(profile));
</script>

<section class="lifecycle" data-testid="lifecycle">
	{#if profile.running}
		<p>Paperless läuft: <a href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="paperless-link">{profile.running.host}</a></p>
		<button onclick={stop} disabled={busy}>Sichern und stoppen</button>
	{:else}
		{#if profile.ageIdentity}
			<fieldset class="restore">
				<legend>Beim Start</legend>
				<label><input type="radio" bind:group={choice} value="newest" disabled={!backups?.length} />
					Neueste Sicherung wiederherstellen
					{#if backups?.length}<small data-testid="newest-backup">({backups.find((b) => b.complete)?.pieceCid.slice(-12) ?? backups[0].pieceCid.slice(-12)}, {backups.find((b) => b.complete)?.copies.length ?? backups[0].copies.length} Kopien)</small>
					{:else if backups}<small>(keine gefunden)</small>{:else}<small>(lese …)</small>{/if}
				</label>
				<label><input type="radio" bind:group={choice} value="empty" /> Leeres Paperless</label>
				{#if backupsError}<small class="hint">{backupsError}</small>{/if}
			</fieldset>
		{/if}
		<button onclick={start} disabled={busy || missing.length > 0}>Paperless starten</button>
		{#if missing.length}<p class="hint">Es fehlt noch: {missing.join(', ')}</p>{/if}
	{/if}
	{#if progress}<p data-testid="progress">{progress} …</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.lifecycle { margin: 1.5rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 0.5rem; }
	button { padding: 0.6rem 1rem; font-size: 1rem; }
	.hint { color: #666; }
	.restore { border: none; padding: 0; margin: 0 0 0.75rem; }
	.restore label { display: block; }
	.error { color: #b00020; }
</style>
