<script>
	import { privateKeyToAccount } from 'viem/accounts';
	import { alephPrivateKey } from '$lib/keys/derive.js';
	import { loadProfile, vmPayer } from '$lib/profile.js';
	import { alephBalance, filecoinBalance, hoursOf, duration, amount, LOW_GAS, RESERVE_HOURS, confidentialCreditsPerHour, runningCreditsPerHour } from '$lib/balances.js';
	import { PAPERLESS_VM } from '$lib/vm.js';
	import { CREDITS_URL, creditsBalance, creditsCatalog, choosePlan, fundVm, planOf, PLANS } from '$lib/credits.js';
	import TopUp from '$lib/TopUp.svelte';
	import { marketPrices, money, UNITS } from '$lib/prices.js';

	/** @type {{ master: Uint8Array, version?: number, onsummary?: (s: { money: string, lasts: string, plan: string, warnings: string[] } | null) => void }} */
	let { master, version = 0, onsummary = () => {} } = $props();

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
	// While a Paperless runs (or is starting), what runs already includes it: the
	// rate is what the account spends, and the start reserve does not apply.
	let vmUp = $state(false);
	const perHour = $derived(vmUp ? (runningPerHour ?? vmPerHour) : vmPerHour + (runningPerHour ?? 0));
	const reserve = $derived(RESERVE_HOURS * (vmPerHour + (runningPerHour ?? 0)));
	// Credits also as euros, dollars or ALEPH, as the viewer chose (kept in this browser only).
	const UNIT_KEY = 'paperless-credit-unit';
	const UNIT_LABELS = { credits: 'nur Credits', eur: 'Euro', usd: 'Dollar', aleph: 'ALEPH' };
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
	const inMoney = (/** @type {number} */ credits) => money(credits, unit, prices);

	// The monthly package and buying hours (Le Space Credits, belege#591).
	let planBusy = $state(false);
	let planError = $state('');
	let planNote = $state('');
	// The service's own list once it answered; until then the known one.
	let plans = $state(/** @type {{ id: string, hours: number, priceCredits: number }[]} */ ([...PLANS]));
	if (CREDITS_URL) creditsCatalog().then((c) => c?.plans.length && (plans = c.plans)).catch(() => {});
	const day = (iso) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '');
	const planLine = (p) => {
		const plan = p && planOf(p.id, plans);
		if (!p) return '';
		return `Paket ${plan ? `${plan.hours} h` : p.id}${p.hoursLeft != null ? ` · noch ${Math.max(0, Math.floor(p.hoursLeft))} h` : ''}${p.periodEnd ? ` bis ${day(p.periodEnd)}` : ''}`;
	};
	async function plan(/** @type {string | null} */ id) {
		if (id === null && !confirm('Paket zum Ende des Zeitraums beenden? Es wird nichts zurückerstattet; danach zahlst du nur noch, was du aufläufst.')) return;
		planBusy = true;
		planError = planNote = '';
		try {
			const r = await choosePlan(master, id);
			planNote = id ? `Paket gewählt${r.periodEnd ? `, Zeitraum bis ${day(r.periodEnd)}` : ''}.` : 'Paket endet mit dem Zeitraum.';
			await read();
		} catch (e) {
			planError = e instanceof Error ? e.message : String(e);
		} finally {
			planBusy = false;
		}
	}
	async function buyHours(/** @type {number} */ hours) {
		planBusy = true;
		planError = planNote = '';
		try {
			const r = await fundVm(master, hours);
			planNote = `${hours} h geholt: ${amount(r.alephCredits, 0)} Aleph-Credits für ${amount(r.chargedCredits / 100)} €${r.expiration ? `, gültig bis ${day(r.expiration)}` : ''}. Aleph zeigt sie in ein, zwei Minuten.`;
			await read();
		} catch (e) {
			planError = e instanceof Error ? e.message : String(e);
		} finally {
			planBusy = false;
		}
	}

	const test = $derived(network !== 'mainnet');
	const gasName = $derived(test ? 'tFIL' : 'FIL');

	async function read() {
		reading = true;
		alephError = filecoinError = false;
		await Promise.all([
			alephBalance(alephPayer).then((b) => (aleph = b)).catch(() => ((aleph = null), (alephError = true))),
			creditsBalance(master).then((b) => ((lsCredits = b), (lsCreditsError = ''))).catch((e) => ((lsCredits = null), (lsCreditsError = e.message))),
			confidentialCreditsPerHour(PAPERLESS_VM).then((p) => (vmPerHour = p)),
			marketPrices().then((p) => (prices = p)),
			runningCreditsPerHour(alephPayer).then((p) => (runningPerHour = p)).catch(() => (runningPerHour = null)),
			payer && filecoinBalance(network, payer).then((b) => (filecoin = b)).catch(() => ((filecoin = null), (filecoinError = true)))
		]);
		reading = false;
	}

	// One line for the simple view: the balance in euros, how long it lasts, and
	// a warning only when money runs short (the same thresholds as below).
	$effect(() => {
		if (!alephPayer || (!aleph && !lsCredits)) return onsummary(null);
		const warnings = [];
		if (aleph && !vmUp && vmPerHour && aleph.credits < reserve) warnings.push(`Für einen Start fehlen noch ${amount(reserve - aleph.credits, 0)} Aleph-Credits${money(reserve - aleph.credits, 'eur', prices) ? ` (${money(reserve - aleph.credits, 'eur', prices)})` : ''}.`);
		if (filecoin && filecoin.runwayDays !== null && filecoin.runwayDays < 30) warnings.push('Das Guthaben für die Sicherungen reicht weniger als einen Monat.');
		if (filecoin && filecoin.gas < LOW_GAS) warnings.push(`Wenig ${gasName} für die Sicherungen.`);
		onsummary({
			money: CREDITS_URL && lsCredits ? `${amount(lsCredits.credits / 100)} €` : aleph ? money(aleph.credits, 'eur', prices) : '',
			lasts: aleph && perHour ? duration(hoursOf(aleph.credits, perHour)) : '',
			plan: planLine(lsCredits?.plan),
			warnings
		});
	});

	// Again whenever the profile changed (setup, start, stop).
	$effect(() => {
		version;
		loadProfile(master)
			.then((p) => {
				payer = p.payer ?? '';
				appPays = Boolean(p.appPays);
				vmUp = Boolean(p.running || p.starting);
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
				{#if lsCredits}
					<dt>Paket</dt>
					<dd data-testid="plan">
						{#if lsCredits.plan}
							<span data-testid="plan-current">{planLine(lsCredits.plan)}</span>
							<button class="quiet" onclick={() => plan(null)} disabled={planBusy} data-testid="plan-end">Paket beenden</button>
						{:else}
							<span class="hint" data-testid="plan-none">Kein Paket gewählt. Mit einem Paket holt die App die Aleph-Credits für deine VM aus diesem Guthaben.</span>
						{/if}
						<div class="plans">
							{#each plans as p (p.id)}
								<button class="plan" class:current={lsCredits.plan?.id === p.id} onclick={() => plan(p.id)} disabled={planBusy || lsCredits.plan?.id === p.id} data-testid={`plan-${p.id}`}>{p.hours} h im Monat · {amount(p.priceCredits / 100)} €</button>
							{/each}
						</div>
						{#if appPays && lsCredits.plan}
							<div class="plans">
								<span class="hint">Stunden nachkaufen:</span>
								{#each [5, 10, 30] as h (h)}<button class="quiet" onclick={() => buyHours(h)} disabled={planBusy} data-testid={`buy-${h}`}>+{h} h</button>{/each}
							</div>
						{/if}
						{#if planNote}<p class="hint" data-testid="plan-note">{planNote}</p>{/if}
						{#if planError}<p class="warn" data-testid="plan-error">{planError}</p>{/if}
					</dd>
				{/if}
			{/if}
			<dt>Aleph-Credits{#if appPays} <small>(Konto der App)</small>{/if}</dt>
			<dd data-testid="balance-credits">
				{#if aleph}
					{amount(aleph.credits, 0)} {#if inMoney(aleph.credits)}<span class="money" data-testid="balance-money">{inMoney(aleph.credits)}</span>{/if}
					{#if vmUp && perHour}<small data-testid="balance-rate">· reicht noch ca. {duration(hoursOf(aleph.credits, perHour))} ({amount(perHour, 0)}/h{inMoney(perHour) ? `, ${inMoney(perHour)}/h` : ''}, was gerade läuft)</small>
					{:else if vmPerHour}<small data-testid="balance-rate">· reicht für ca. {duration(hoursOf(aleph.credits, perHour))} Paperless ({amount(vmPerHour, 0)}/h{inMoney(vmPerHour) ? `, ${inMoney(vmPerHour)}/h` : ''}{runningPerHour ? ` + ${amount(runningPerHour, 0)}/h, was schon läuft` : ''})</small>{/if}
					{#if !vmUp && vmPerHour && aleph.credits < reserve}<br /><span class="warn" data-testid="balance-reserve">Unter der Tagesreserve von {amount(reserve, 0)}{inMoney(reserve) ? ` (${inMoney(reserve)})` : ''}: Aleph nimmt so keinen Start an.</span>{/if}
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
		<p class="units">
			<label>Credits auch in
				<select value={unit} onchange={(e) => setUnit(e.currentTarget.value)} data-testid="credit-unit">
					{#each UNITS as u (u)}<option value={u}>{UNIT_LABELS[u]}</option>{/each}
				</select></label>
			<small class="hint">1 $ = 1.000.000 Credits (Aleph){#if prices} · ALEPH {amount(prices.alephEur, 4)} €, 1 $ = {amount(prices.usdEur, 3)} € (CoinGecko, {new Date(prices.at).toLocaleTimeString('de-DE', { timeStyle: 'short' })}){:else if unit === 'eur' || unit === 'aleph'} · Kurse gerade nicht abrufbar{/if}</small>
		</p>
		<button class="quiet" onclick={read} disabled={reading}>{reading ? 'Lese …' : 'Aktualisieren'}</button>
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
	.money { color: var(--text-2); margin-left: 0.3rem; }
	.units { margin: 0.5rem 0 0; font-size: 0.9rem; }
	.units select { margin-left: 0.3rem; }
	.plans { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.4rem 0; align-items: baseline; }
	.plan.current { font-weight: 600; }
	.quiet { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; margin: 0.5rem 0 0; font-size: 0.9rem; }
</style>
