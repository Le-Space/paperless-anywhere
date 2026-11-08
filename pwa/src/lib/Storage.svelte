<script>
	// The documents' storage against what the package includes (8 GB in the
	// pilot): measured in the running VM, or the last backup's size when off.
	import { onDestroy } from 'svelte';
	import { statusToken } from '$lib/keys/derive.js';
	import { storageView } from '$lib/storage.js';
	import { vmStatus } from '$lib/vm.js';

	/** @type {{ master: Uint8Array, profile: any }} */
	let { master, profile } = $props();

	let measured = $state(/** @type {number | null} */ (null));
	let timer = /** @type {ReturnType<typeof setInterval> | undefined} */ (undefined);

	async function read() {
		const host = profile?.running?.host;
		if (!host) return;
		const s = await vmStatus(host, statusToken(master)).catch(() => null);
		const bytes = s?.storage?.documentsBytes;
		if (typeof bytes === 'number') measured = bytes;
	}
	$effect(() => {
		clearInterval(timer);
		measured = null;
		if (profile?.running?.host) {
			read();
			timer = setInterval(read, 60_000);
		}
	});
	onDestroy(() => clearInterval(timer));

	const view = $derived(profile?.running ? storageView(measured, 'running') : storageView(profile?.lastBackup?.size, 'backup'));
</script>

{#if view}
	<div class="storage is-{view.level}" data-testid="storage">
		<p class="line"><span class="label">Speicher</span> <strong data-testid="storage-used">{view.text}</strong></p>
		<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(view.share * 100)} aria-label="Belegter Speicher"><span style="width: {view.share * 100}%"></span></div>
		<p class="hint" data-testid="storage-hint">{view.hint}</p>
	</div>
{/if}

<style>
	.storage { margin: 1rem 0 0; padding: 0.75rem 1rem; border-radius: var(--radius-sm); background: var(--surface-2); }
	.line { margin: 0 0 0.4rem; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: baseline; }
	.label { color: var(--text-2); }
	.meter { height: 8px; border-radius: 999px; background: var(--surface); overflow: hidden; }
	.meter span { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
	.is-near .meter span { background: var(--warn); }
	.is-over .meter span { background: var(--danger); }
	.hint { margin: 0.4rem 0 0; font-size: 0.85rem; color: var(--text-2); }
	.is-near .hint { color: var(--warn); }
	.is-over .hint { color: var(--danger); }
</style>
