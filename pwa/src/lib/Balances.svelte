<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import { loadProfile, vmPayer } from '$lib/profile.js';
	import { alephBalance, filecoinBalance, hoursOf, duration, amount, LOW_GAS, RESERVE_HOURS, confidentialCreditsPerHour, runningCreditsPerHour } from '$lib/balances.js';
	import { PAPERLESS_VM } from '$lib/vm.js';
	import { marketPrices, money, UNITS } from '$lib/prices.js';
	import { format, lang, t } from '$lib/i18n/index.js';
	import { balancesRound } from '$lib/balance-refresh.js';
	import RefreshBalances from '$lib/RefreshBalances.svelte';

	/** @type {{ master: Uint8Array, version?: number, onsummary?: (s: { money: string, lasts: string, warnings: ('start' | 'backups')[] } | null) => void, onshown?: (shown: boolean) => void }} */
	let { master, version = 0, onsummary = () => {}, onshown = () => {} } = $props();

	const f = $derived($t.funds);
	// Numbers in the language's notation, following the switch in the header.
	const num = (/** @type {number} */ n, /** @type {number} */ digits = 2) => amount(n, digits, $lang);
	const appAddress = privateKeyToAccount(alephPrivateKey(master)).address;
	// Who pays the VM on Aleph, and the wallet that pays the backups on Filecoin.
	let alephPayer = $state('');
	let payer = $state('');
	let appPays = $state(false);
	// Crypto balances are shown only where the person pays with them: the VM's
	// Aleph credits when the app's address or their own wallet pays it (not when
	// Le Space pays from a package), the Filecoin side when their wallet pays the
	// backups (not when Le Space Credits do). The start warning still reads
	// Le Space's account for this customer, without showing it.
	let showAleph = $state(false);
	let showFilecoin = $state(false);
	$effect(() => onshown(showAleph || showFilecoin));
	let network = $state('calibration');
	/** @type {{ credits: number, aleph: number } | null} */
	let aleph = $state(null);
	/** @type {Awaited<ReturnType<typeof filecoinBalance>> | null} */
	let filecoin = $state(null);
	let alephError = $state(false);
	let filecoinError = $state(false);
	let reading = $state(false);
	// Aleph's current price for a Paperless and what the account already spends.
	let vmPerHour = $state(0);
	/** @type {number | null} */
	let runningPerHour = $state(null);
	// While a Paperless runs (or is starting), what runs already includes it: the
	// rate is what the account spends, and the start reserve does not apply.
	let vmUp = $state(false);
	const perHour = $derived(vmUp ? (runningPerHour ?? vmPerHour) : vmPerHour + (runningPerHour ?? 0));
	const reserve = $derived(RESERVE_HOURS * (vmPerHour + (runningPerHour ?? 0)));
	// Credits also as euros, dollars or ALEPH, as the viewer chose (kept in this browser only).
	const UNIT_KEY = 'paperless-credit-unit';
	let unit = $state(/** @type {typeof UNITS[number]} */ ('eur'));
	try {
		const saved = localStorage.getItem(UNIT_KEY);
		if (saved && /** @type {readonly string[]} */ (UNITS).includes(saved)) unit = /** @type {any} */ (saved);
	} catch {
		// Storage blocked: the default stays.
	}
	const setUnit = (/** @type {any} */ u) => {
		unit = u;
		try {
			localStorage.setItem(UNIT_KEY, u);
		} catch {
			// Storage blocked: only for this visit.
		}
	};
	/** @type {import('$lib/prices.js').Prices | null} */
	let prices = $state(null);
	const inMoney = (/** @type {number} */ credits) => money(credits, unit, prices, $lang);

	const test = $derived(network !== 'mainnet');
	const gasName = $derived(test ? 'tFIL' : 'FIL');

	async function read() {
		reading = true;
		alephError = filecoinError = false;
		await Promise.all([
			alephBalance(alephPayer).then((b) => (aleph = b)).catch(() => ((aleph = null), (alephError = true))),
			confidentialCreditsPerHour(PAPERLESS_VM).then((p) => (vmPerHour = p)),
			marketPrices().then((p) => (prices = p)),
			runningCreditsPerHour(alephPayer).then((p) => (runningPerHour = p)).catch(() => (runningPerHour = null)),
			showFilecoin && filecoinBalance(network, payer).then((b) => (filecoin = b)).catch(() => ((filecoin = null), (filecoinError = true)))
		]);
		reading = false;
	}

	// For the simple view: plain warnings, no crypto names (those stay below,
	// under "Advanced"), and the balance in euros where no package pays.
	$effect(() => {
		$lang;
		if (!alephPayer || !aleph) return onsummary(null);
		const warnings = [];
		if (!vmUp && vmPerHour && aleph.credits < reserve) warnings.push('start');
		if (filecoin && ((filecoin.runwayDays !== null && filecoin.runwayDays < 30) || filecoin.gas < LOW_GAS)) warnings.push('backups');
		onsummary({
			money: showAleph ? money(aleph.credits, 'eur', prices) : '',
			lasts: perHour ? duration(hoursOf(aleph.credits, perHour)) : '',
			warnings
		});
	});

	// Again whenever the profile changed (setup, start, stop).
	$effect(() => {
		version;
		$balancesRound;
		loadProfile(master)
			.then((p) => {
				payer = p.payer ?? '';
				appPays = Boolean(p.appPays);
				showAleph = !p.leSpacePays && Boolean(p.appPays || p.payer);
				showFilecoin = Boolean(p.payer) && !p.backupsByCredits;
				vmUp = Boolean(p.running || p.starting);
				alephPayer = vmPayer(p, appAddress) ?? '';
				network = p.network ?? 'calibration';
				if (alephPayer) return read();
			})
			.catch(() => {});
	});
</script>

{#if showAleph || showFilecoin}
	<section class="balances" data-testid="balances">
		<h2>{showAleph && appPays ? f.titleBoth : f.titleWallet}</h2>
		<p class="hint"><RefreshBalances testid="balances-refresh" /></p>
		<p class="hint keys" data-testid="balance-keys">{showAleph && appPays ? f.keys.app : ''}{payer ? f.keys.wallet : ''}{f.keys.leSpace}</p>
		<dl>
			{#if showAleph}
			<dt>{f.alephCredits}{#if appPays} <small>{f.appAddress}</small>{/if}</dt>
			<dd data-testid="balance-credits">
				{#if aleph}
					{num(aleph.credits, 0)} {#if inMoney(aleph.credits)}<span class="money" data-testid="balance-money">{inMoney(aleph.credits)}</span>{/if}
					{#if vmUp && perHour}<small data-testid="balance-rate">{f.lastsRunning(($lang, duration(hoursOf(aleph.credits, perHour))), `${num(perHour, 0)}/h${inMoney(perHour) ? `, ${inMoney(perHour)}/h` : ''}`)}</small>
					{:else if vmPerHour}<small data-testid="balance-rate">{f.lastsFor(($lang, duration(hoursOf(aleph.credits, perHour))), `${num(vmPerHour, 0)}/h${inMoney(vmPerHour) ? `, ${inMoney(vmPerHour)}/h` : ''}`, runningPerHour ? num(runningPerHour, 0) : null)}</small>{/if}
					{#if !vmUp && vmPerHour && aleph.credits < reserve}<br /><span class="warn" data-testid="balance-reserve">{f.belowReserve(`${num(reserve, 0)}${inMoney(reserve) ? ` (${inMoney(reserve)})` : ''}`)}</span>{/if}
				{:else if alephError}<span class="hint">{f.unreadable}</span>{:else}…{/if}
			</dd>
			{#if aleph?.aleph}<dt>ALEPH</dt><dd>{num(aleph.aleph)}</dd>{/if}
			{/if}

			{#if showFilecoin}
			<dt>{gasName} <small>{f.gas}</small></dt>
			<dd data-testid="balance-gas">
				{#if filecoin}
					{num(filecoin.gas, 3)}
					{#if filecoin.gas < LOW_GAS}<br /><span class="warn">{f.lowGas(gasName)}</span>{/if}
				{:else if filecoinError}<span class="hint">{f.unreadable}</span>{:else}…{/if}
			</dd>
			{#if filecoin}
				<dt>{f.usdfcInWallet(test)}</dt>
				<dd>{num(filecoin.usdfc)}</dd>
				<dt>{f.filecoinPay} <small>{f.forBackups}</small></dt>
				<dd data-testid="balance-deposit">
					{f.available(num(filecoin.available))} <small>{f.deposited(num(filecoin.deposit))}</small>
					{#if filecoin.perMonth > 0}<br /><small>{f.spend(num(filecoin.perMonth), filecoin.runwayDays)}</small>{/if}
					{#if filecoin.runwayDays !== null && filecoin.runwayDays < 30}<br /><span class="warn">{f.lessThanMonth}</span>{/if}
				</dd>
			{/if}
			{/if}
		</dl>
		{#if showAleph}
		<p class="units">
			<label>{f.alsoIn}
				<select value={unit} onchange={(e) => setUnit(e.currentTarget.value)} data-testid="credit-unit">
					{#each UNITS as u (u)}<option value={u}>{f.units[u]}</option>{/each}
				</select></label>
			<small class="hint">{f.peg(num(1_000_000, 0))}{#if prices}{f.rates(num(prices.alephEur, 4), num(prices.usdEur, 3), format.dateTime(prices.at, { timeStyle: 'short' }, $lang))}{:else if unit === 'eur' || unit === 'aleph'}{f.noRates}{/if}</small>
		</p>
		{/if}
		<button class="quiet" onclick={read} disabled={reading}>{reading ? f.reading : f.refresh}</button>
	</section>
{/if}

<style>
	.balances { margin: 0 0 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.25rem; }
	h2 { font-size: 1rem; margin: 0.25rem 0 0.5rem; }
	dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 0.75rem; margin: 0; }
	dt { color: var(--text-2); }
	dd { margin: 0; }
	@media (max-width: 480px) { dl { grid-template-columns: 1fr; } dd { margin-bottom: 0.4rem; } }
	.warn { color: var(--warn); font-size: 0.9rem; }
	.hint { color: var(--text-2); }
	.keys { margin: 0 0 0.6rem; font-size: 0.9rem; }
	.money { color: var(--text-2); margin-left: 0.3rem; }
	.units { margin: 0.5rem 0 0; font-size: 0.9rem; }
	.units select { margin-left: 0.3rem; }
	.quiet { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; margin: 0.5rem 0 0; font-size: 0.9rem; }
</style>
