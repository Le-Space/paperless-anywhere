<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import { loadProfile, vmPayer } from '$lib/profile.js';
	import { alephBalance, filecoinBalance, hoursOf, duration, amount, LOW_GAS, RESERVE_HOURS, confidentialCreditsPerHour, runningCreditsPerHour } from '$lib/balances.js';
	import { PAPERLESS_VM } from '$lib/vm.js';
	import { CREDITS_URL, creditsBalance } from '$lib/credits.js';
	import TopUp from '$lib/TopUp.svelte';

	/** @type {{ master: Uint8Array, version?: number }} */
	let { master, version = 0 } = $props();

	const appAddress = privateKeyToAccount(alephPrivateKey(master)).address;
	// Who pays the VM on Aleph, and the wallet that pays the backups on Filecoin.
	let alephPayer = $state('');
	let payer = $state('');
	let appPays = $state(false);
	let network = $state('calibration');
	/** @type {{ credits: number, aleph: number } | null} */
	let aleph = $state(null);
	/** @type {Awaited<ReturnType<typeof filecoinBalance>> | null} */
	let filecoin = $state(null);
	let alephError = $state(false);
	let filecoinError = $state(false);
	let reading = $state(false);
	/** @type {Awaited<ReturnType<typeof creditsBalance>>} */
	let lsCredits = $state(null);
	let lsCreditsError = $state('');
	// Aleph's current price for a Paperless and what the account already spends.
	let vmPerHour = $state(0);
	/** @type {number | null} */
	let runningPerHour = $state(null);
	const reserve = $derived(RESERVE_HOURS * (vmPerHour + (runningPerHour ?? 0)));

	const test = $derived(network !== 'mainnet');
	const gasName = $derived(test ? 'tFIL' : 'FIL');

	async function read() {
		reading = true;
		alephError = filecoinError = false;
		await Promise.all([
			alephBalance(alephPayer).then((b) => (aleph = b)).catch(() => ((aleph = null), (alephError = true))),
			creditsBalance(master).then((b) => ((lsCredits = b), (lsCreditsError = ''))).catch((e) => ((lsCredits = null), (lsCreditsError = e.message))),
			confidentialCreditsPerHour(PAPERLESS_VM).then((p) => (vmPerHour = p)),
			runningCreditsPerHour(alephPayer).then((p) => (runningPerHour = p)).catch(() => (runningPerHour = null)),
			payer && filecoinBalance(network, payer).then((b) => (filecoin = b)).catch(() => ((filecoin = null), (filecoinError = true)))
		]);
		reading = false;
	}

	// Again whenever the profile changed (setup, start, stop).
	$effect(() => {
		version;
		loadProfile(master)
			.then((p) => {
				payer = p.payer ?? '';
				appPays = Boolean(p.appPays);
				alephPayer = vmPayer(p, appAddress) ?? '';
				network = p.network ?? 'calibration';
				if (alephPayer) return read();
			})
			.catch(() => {});
	});
</script>

{#if alephPayer}
	<section class="balances" data-testid="balances">
		<h2>{appPays ? 'Guthaben' : 'Guthaben des zahlenden Kontos'}</h2>
		<dl>
			{#if CREDITS_URL}
				<dt>Le Space Credits <small>(Paperless)</small></dt>
				<dd data-testid="balance-ls-credits">
					{#if lsCredits}
						{amount(lsCredits.credits / 100)} €
						{#if lsCredits.reserved}<small>· davon {amount(lsCredits.reserved / 100)} € für die laufende VM vorgemerkt</small>{/if}
					{:else if lsCreditsError}<span class="hint">{lsCreditsError}</span>{:else}…{/if}
					{#if lsCredits}<TopUp {master} credits={lsCredits.credits} onbooked={read} />{/if}
				</dd>
			{/if}
			<dt>Aleph-Credits{#if appPays} <small>(Konto der App)</small>{/if}</dt>
			<dd data-testid="balance-credits">
				{#if aleph}
					{amount(aleph.credits, 0)}
					{#if vmPerHour}<small data-testid="balance-rate">· reicht für ca. {duration(hoursOf(aleph.credits, vmPerHour + (runningPerHour ?? 0)))} Paperless ({amount(vmPerHour, 0)}/h{runningPerHour ? ` + ${amount(runningPerHour, 0)}/h, was schon läuft` : ''})</small>{/if}
					{#if vmPerHour && aleph.credits < reserve}<br /><span class="warn" data-testid="balance-reserve">Unter der Tagesreserve von {amount(reserve, 0)}: Aleph nimmt so keinen Start an.</span>{/if}
				{:else if alephError}<span class="hint">nicht lesbar</span>{:else}…{/if}
			</dd>
			{#if aleph?.aleph}<dt>ALEPH</dt><dd>{amount(aleph.aleph)}</dd>{/if}

			{#if payer}
			<dt>{gasName} <small>(Gas)</small></dt>
			<dd data-testid="balance-gas">
				{#if filecoin}
					{amount(filecoin.gas, 3)}
					{#if filecoin.gas < LOW_GAS}<br /><span class="warn">Wenig Gas: Sitzungsschlüssel verlängern oder einzahlen braucht {gasName}.</span>{/if}
				{:else if filecoinError}<span class="hint">nicht lesbar</span>{:else}…{/if}
			</dd>
			{#if filecoin}
				<dt>USDFC{test ? ' (Test)' : ''} im Wallet</dt>
				<dd>{amount(filecoin.usdfc)}</dd>
				<dt>Filecoin Pay <small>(für Sicherungen)</small></dt>
				<dd data-testid="balance-deposit">
					{amount(filecoin.available)} verfügbar <small>von {amount(filecoin.deposit)} eingezahlt</small>
					{#if filecoin.perMonth > 0}<br /><small>Verbrauch ca. {amount(filecoin.perMonth)} USDFC im Monat{filecoin.runwayDays !== null ? `, reicht ca. ${filecoin.runwayDays} Tage` : ''}</small>{/if}
					{#if filecoin.runwayDays !== null && filecoin.runwayDays < 30}<br /><span class="warn">Reicht weniger als einen Monat: einzahlen, sonst schlagen Sicherungen fehl.</span>{/if}
				</dd>
			{/if}
			{/if}
		</dl>
		<button class="quiet" onclick={read} disabled={reading}>{reading ? 'Lese …' : 'Aktualisieren'}</button>
	</section>
{/if}

<style>
	.balances { margin: 1.5rem 0; padding: 0.5rem 0.75rem; background: #f6f8f6; border-radius: 4px; }
	h2 { font-size: 1rem; margin: 0.25rem 0 0.5rem; }
	dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 0.75rem; margin: 0; }
	dt { color: #444; }
	dd { margin: 0; }
	.warn { color: #b26a00; font-size: 0.9rem; }
	.hint { color: #666; }
	.quiet { background: none; border: none; color: #666; text-decoration: underline; padding: 0; margin: 0.5rem 0 0; font-size: 0.9rem; }
</style>
