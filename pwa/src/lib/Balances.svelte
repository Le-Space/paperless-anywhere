<script>
	import { loadProfile } from '$lib/profile.js';
	import { alephBalance, filecoinBalance, hoursOf, duration, amount, RESERVE_CREDITS, LOW_GAS, PAPERLESS_CREDITS_PER_HOUR } from '$lib/balances.js';

	/** @type {{ master: Uint8Array, version?: number }} */
	let { master, version = 0 } = $props();

	let payer = $state('');
	let network = $state('calibration');
	/** @type {{ credits: number, aleph: number } | null} */
	let aleph = $state(null);
	/** @type {Awaited<ReturnType<typeof filecoinBalance>> | null} */
	let filecoin = $state(null);
	let alephError = $state(false);
	let filecoinError = $state(false);
	let reading = $state(false);

	const test = $derived(network !== 'mainnet');
	const gasName = $derived(test ? 'tFIL' : 'FIL');

	async function read() {
		reading = true;
		alephError = filecoinError = false;
		await Promise.all([
			alephBalance(payer).then((b) => (aleph = b)).catch(() => ((aleph = null), (alephError = true))),
			filecoinBalance(network, payer).then((b) => (filecoin = b)).catch(() => ((filecoin = null), (filecoinError = true)))
		]);
		reading = false;
	}

	// Again whenever the profile changed (setup, start, stop).
	$effect(() => {
		version;
		loadProfile(master)
			.then((p) => {
				payer = p.payer ?? '';
				network = p.network ?? 'calibration';
				if (payer) return read();
			})
			.catch(() => {});
	});
</script>

{#if payer}
	<section class="balances" data-testid="balances">
		<h2>Guthaben des zahlenden Kontos</h2>
		<dl>
			<dt>Aleph-Credits</dt>
			<dd data-testid="balance-credits">
				{#if aleph}
					{amount(aleph.credits, 0)} <small>· reicht für ca. {duration(hoursOf(aleph.credits))} Paperless ({amount(PAPERLESS_CREDITS_PER_HOUR, 0)}/h)</small>
					{#if aleph.credits < RESERVE_CREDITS}<br /><span class="warn" data-testid="balance-reserve">Unter der Tagesreserve von {amount(RESERVE_CREDITS, 0)}: Aleph nimmt so keinen Start an.</span>{/if}
				{:else if alephError}<span class="hint">nicht lesbar</span>{:else}…{/if}
			</dd>
			{#if aleph?.aleph}<dt>ALEPH</dt><dd>{amount(aleph.aleph)}</dd>{/if}

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
