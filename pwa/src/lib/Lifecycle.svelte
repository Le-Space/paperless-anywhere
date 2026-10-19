<script>
	import { loadProfile, saveProfile } from '$lib/profile.js';
	import { startPaperless, startRequirements, stopPaperless } from '$lib/lifecycle.js';

	/** @type {{ master: Uint8Array, version?: number }} */
	let { master, version = 0 } = $props();

	/** @type {Record<string, any>} */
	let profile = $state({});
	let progress = $state('');
	let error = $state('');
	let busy = $state(false);

	const reload = async () => (profile = await loadProfile(master));
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
		const running = await startPaperless(master, $state.snapshot(profile), ({ detail, step }) => (progress = detail ?? step));
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
	.error { color: #b00020; }
</style>
