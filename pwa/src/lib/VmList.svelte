<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import { loadProfile, saveProfile } from '$lib/profile.js';
	import { crnAddress, eraseOnNode, forgetInstance, hostname, listVms, nodeState, vmStatus } from '$lib/vm.js';

	/** @type {{ master: Uint8Array, version?: number, onchange?: () => void }} */
	let { master, version = 0, onchange = () => {} } = $props();

	const app = privateKeyToAccount(alephPrivateKey(master));
	/** @type {{ itemHash: string, name: string, createdAt: number, crnHash: string | null, host?: string | null, phase?: string }[] | null} */
	let vms = $state(null);
	/** @type {Record<string, any>} */
	let profile = $state({});
	let error = $state('');
	let busy = $state('');

	async function load() {
		error = '';
		profile = await loadProfile(master);
		if (!profile.payer) return (vms = []);
		const list = await listVms(app.address, profile.payer);
		vms = list;
		// The state of each, without holding up the list.
		for (const vm of list) {
			hostname(vm.itemHash)
				.then(async (host) => {
					const status = host ? await vmStatus(host) : null;
					const crnUrl = vm.crnHash ? await crnAddress(vm.crnHash).catch(() => null) : null;
					const onNode = crnUrl ? await nodeState(crnUrl, vm.itemHash) : null;
					// The VM's own page when it answers, otherwise what its node says.
					const phase = status?.phase ?? (onNode === 'stopping' ? 'wird gestoppt' : onNode ? `auf dem Knoten: ${onNode}` : host ? 'nicht erreichbar' : 'ohne Adresse');
					vms = (vms ?? []).map((v) => (v.itemHash === vm.itemHash ? { ...v, host, phase } : v));
				})
				.catch(() => {});
		}
	}
	$effect(() => {
		version;
		load().catch((e) => (error = e.message));
	});

	async function remove(vm) {
		const isRunning = profile.running?.instanceHash === vm.itemHash;
		const question = isRunning
			? `${vm.name} löschen, ohne letzte Sicherung? (Zum Sichern oben „Sichern und stoppen“.)`
			: `${vm.name} löschen? Die VM wird gestoppt und kostet danach nichts mehr.`;
		if (!confirm(question)) return;
		busy = vm.itemHash;
		error = '';
		try {
			const crnUrl = vm.crnHash ? await crnAddress(vm.crnHash).catch(() => null) : null;
			if (crnUrl) await eraseOnNode(app, vm.itemHash, crnUrl);
			await forgetInstance(app, profile.payer, vm.itemHash, 'paperless-anywhere: removed from the VM list');
			if (isRunning) {
				const { running, ...rest } = profile;
				await saveProfile(master, rest);
			}
			vms = (vms ?? []).filter((v) => v.itemHash !== vm.itemHash);
			onchange();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = '';
		}
	}
	const when = (ms) => new Date(ms).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
</script>

<section class="vms" data-testid="vm-list">
	<h2>Meine VMs <button type="button" class="small" onclick={() => load().catch((e) => (error = e.message))}>Aktualisieren</button></h2>
	{#if vms === null}
		<p class="hint">lese …</p>
	{:else if vms.length === 0}
		<p class="hint">Keine VM läuft.</p>
	{:else}
		{#if vms.length > (profile.running ? 1 : 0)}
			<p class="warn" data-testid="vm-stray">Es laufen VMs, die nicht als gestartet bekannt sind (z. B. ein abgebrochener Start). Sie kosten Credits, bis sie gelöscht sind.</p>
		{/if}
		<ul>
			{#each vms as vm (vm.itemHash)}
				<li data-testid="vm-row">
					<strong>{vm.name}</strong>
					{#if profile.running?.instanceHash === vm.itemHash}<small>(gestartet)</small>{/if}
					<br /><small>seit {when(vm.createdAt)} · {vm.phase ?? 'prüfe …'}
						{#if vm.host && vm.phase === 'ready'} · <a href={`https://${vm.host}/`} target="_blank" rel="noopener">{vm.host}</a>{/if}
						· <code>{vm.itemHash.slice(0, 12)}</code></small>
					<button type="button" onclick={() => remove(vm)} disabled={busy === vm.itemHash}>Löschen</button>
				</li>
			{/each}
		</ul>
	{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.vms { margin-top: 2rem; border-top: 1px solid #ddd; }
	ul { list-style: none; padding: 0; }
	li { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
	button { margin-top: 0.3rem; padding: 0.3rem 0.8rem; }
	button.small { font-size: 0.8rem; margin-left: 0.5rem; }
	.warn { background: #fff4d6; padding: 0.5rem 0.75rem; border-radius: 4px; }
	.hint { color: #666; }
	.error { color: #b00020; }
	code { font-size: 0.8rem; }
</style>
