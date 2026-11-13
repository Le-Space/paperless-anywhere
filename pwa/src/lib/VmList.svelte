<script>
	import { confidentialCreditsPerHour } from '$lib/balances.js';
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey, fixedHostLabel, statusToken } from '$lib/keys/derive.js';
	import { loadProfile, updateProfile } from '$lib/profile.js';
	import { revokeBackupKey } from '$lib/lifecycle.js';
	import { startingInstance } from '$lib/starting.js';
	import { crnAddress, eraseOnNode, FIXED_HOST_DOMAIN, forgetInstance, hostname, listVms, nodeState, ownInstance, PAPERLESS_VM, publicAddress, vmStatus } from '$lib/vm.js';
	import { pinsOf } from '@le-space/attest-wasm/instance';
	import { format, lang, t, tr } from '$lib/i18n/index.js';

	/** @type {{ master: Uint8Array, version?: number, onchange?: () => void }} */
	let { master, version = 0, onchange = () => {} } = $props();

	const app = privateKeyToAccount(alephPrivateKey(master));
	/** @type {{ itemHash: string, name: string, createdAt: number, crnHash: string | null, payer: string, host?: string | null, phase?: string }[] | null} */
	let vms = $state(null);
	/** @type {Record<string, any>} */
	let profile = $state({});
	let error = $state('');
	/** What happened besides the deletion, e.g. a revoke left for later. */
	let notice = $state('');
	let busy = $state('');
	// Aleph's current price for one Paperless.
	let perHour = $state(0);
	confidentialCreditsPerHour(PAPERLESS_VM).then((p) => (perHour = p));

	async function load() {
		error = '';
		profile = await loadProfile(master);
		// Every Paperless this app key started, whoever paid it: the wallet, the
		// app itself (appPays), or a wallet used before.
		const list = await listVms(app.address);
		vms = list;
		// The state of each, without holding up the list.
		for (const vm of list) {
			hostname(vm.itemHash)
				.then(async (host) => {
					const status = host ? await vmStatus(host, statusToken(master)) : null;
					const crnUrl = vm.crnHash ? await crnAddress(vm.crnHash).catch(() => null) : null;
					const onNode = crnUrl ? await nodeState(crnUrl, vm.itemHash) : null;
					// The VM's own page when it answers, otherwise what its node says.
					const p = tr().life.vms.phases;
					const phase = status?.phase ?? (onNode === 'stopping' ? p.stopping : onNode ? p.onNode(onNode) : host ? p.unreachable : p.noAddress);
					vms = (vms ?? []).map((v) => (v.itemHash === vm.itemHash ? { ...v, host, phase, up: status?.paperless === true } : v));
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
			? tr().life.vms.removeRunning(vm.name)
			: tr().life.vms.removeOther(vm.name);
		if (!confirm(question)) return;
		busy = vm.itemHash;
		error = '';
		notice = '';
		try {
			const crnUrl = vm.crnHash ? await crnAddress(vm.crnHash).catch(() => null) : null;
			if (crnUrl) await eraseOnNode(app, vm.itemHash, crnUrl);
			await forgetInstance(app, vm.payer, vm.itemHash, 'paperless-anywhere: removed from the VM list');
			if (isRunning || profile.starting?.instanceHash === vm.itemHash) {
				// The production VM is gone: its backup key too, unless a trial still uses it.
				await revokeBackupKey(master, $state.snapshot(profile), vm.itemHash, { onProgress: ({ detail }) => (notice = detail ?? '') });
				profile = await updateProfile(master, ({ running, starting, ...rest }) => ({
					...rest,
					...(running && running.instanceHash !== vm.itemHash ? { running } : {}),
					...(starting && starting.instanceHash !== vm.itemHash ? { starting } : {})
				}));
			}
			vms = (vms ?? []).filter((v) => v.itemHash !== vm.itemHash);
			onchange();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = '';
		}
	}
	// Started by this vault and known: the running one, and one a start in this tab is bringing up.
	const known = (vm) => vm.itemHash === profile.running?.instanceHash || vm.itemHash === profile.starting?.instanceHash || vm.itemHash === $startingInstance;
	const strays = $derived((vms ?? []).filter((vm) => !known(vm)).length);
	// A start whose tab was reloaded or closed leaves a running VM the app no
	// longer knows. Adopting it makes it the running one again, so "Sichern und
	// stoppen" works: its measurements come from the INSTANCE this app key
	// signed (checked here), its address from 2n6, and it must answer as a
	// paperless-anywhere guest.
	async function adopt(vm) {
		if (!confirm(tr().life.vms.adoptConfirm(vm.name))) return;
		busy = vm.itemHash;
		error = '';
		try {
			const content = await ownInstance(app.address, vm.itemHash);
			const trustedExecution = content.environment?.trusted_execution;
			pinsOf(trustedExecution);
			const crnHash = content.requirements?.node?.node_hash;
			if (!crnHash) throw new Error(tr().life.vms.noNode);
			// With a fixed address the VM answers there (name:port), not on its 2n6 name.
			const fixed = profile.dnsToken ? await publicAddress(await crnAddress(crnHash), vm.itemHash).catch(() => null) : null;
			const host = fixed ? `${fixedHostLabel(master)}.${FIXED_HOST_DOMAIN}:${fixed.port}` : await hostname(vm.itemHash);
			if (!host) throw new Error(tr().life.vms.noAddressYet);
			const status = await vmStatus(host, statusToken(master));
			if (!status?.phase) throw new Error(tr().life.vms.notPaperless);
			profile = await updateProfile(master, (fresh) => {
				if (fresh.running) throw new Error(tr().life.vms.alreadyRunning);
				// Adopting the VM of an interrupted start ends that start.
				const { starting, ...rest } = fresh;
				return { ...rest, ...(starting && starting.instanceHash !== vm.itemHash ? { starting } : {}), running: { instanceHash: vm.itemHash, crnHash, host, trustedExecution, payer: vm.payer } };
			});
			onchange();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = '';
		}
	}
	const when = (ms) => format.dateTime(ms, { dateStyle: 'short', timeStyle: 'short' }, $lang);
	const v = $derived($t.life.vms);
</script>

<section class="vms" data-testid="vm-list">
	<h2>{v.title} <button type="button" class="small" onclick={() => load().catch((e) => (error = e.message))}>{v.refresh}</button></h2>
	{#if vms === null}
		<p class="hint">{v.reading}</p>
	{:else if vms.length === 0}
		<p class="hint">{v.none}</p>
	{:else}
		{#if strays > 0}
			<p class="warn" data-testid="vm-stray">{v.stray}</p>
		{/if}
		<ul>
			{#each vms as vm (vm.itemHash)}
				<li data-testid="vm-row">
					<strong>{vm.name}</strong>
					{#if profile.running?.instanceHash === vm.itemHash}<small>{v.started}</small>{:else if $startingInstance === vm.itemHash}<small data-testid="vm-starting">{v.startingNow}</small>{:else if profile.starting?.instanceHash === vm.itemHash}<small data-testid="vm-interrupted">{v.interrupted}</small>{/if}
					<br /><small>{v.since(when(vm.createdAt))} · {#if perHour}{v.costs(format.number(perHour, undefined, $lang))} ·{/if} {vm.phase ?? v.checking}
						{#if vm.host && vm.up} · <a href={`https://${vm.host}/`} target="_blank" rel="noopener">{vm.host}</a>{/if}
						· <code>{vm.itemHash.slice(0, 12)}</code></small>
					{#if !profile.running && $startingInstance !== vm.itemHash}
						<button type="button" onclick={() => adopt(vm)} disabled={busy === vm.itemHash} data-testid="vm-adopt">{v.adopt}</button>
					{/if}
					<button type="button" onclick={() => remove(vm)} disabled={busy === vm.itemHash} data-testid="vm-remove">{v.remove}</button>
				</li>
			{/each}
		</ul>
	{/if}
	{#if notice}<p class="hint" data-testid="vm-notice">{notice}</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.vms { margin: 0 0 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.25rem; }
	ul { list-style: none; padding: 0; }
	li { padding: 0.5rem 0; border-bottom: 1px solid var(--line); }
	button { margin-top: 0.3rem; padding: 0.3rem 0.8rem; }
	button.small { font-size: 0.8rem; margin-left: 0.5rem; }
	.warn { background: var(--warn-bg); padding: 0.5rem 0.75rem; border-radius: 4px; }
	.hint { color: var(--text-2); }
	.error { color: var(--danger); }
	code { font-size: 0.8rem; }
</style>
