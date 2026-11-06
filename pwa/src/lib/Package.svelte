<script>
	// What a customer sees of money: the package, the balance in euros, topping
	// up and the invoices (Le Space Credits, belege#591). No crypto here: Aleph
	// credits, FIL and USDFC are under "Erweitert" (Balances).
	import { loadProfile } from '$lib/profile.js';
	import { amount } from '$lib/balances.js';
	import { creditsBalance, creditsCatalog, creditsPurchases, choosePlan, fundVm, planOf, PLANS } from '$lib/credits.js';
	import TopUp from '$lib/TopUp.svelte';

	/** @type {{ master: Uint8Array, version?: number }} */
	let { master, version = 0 } = $props();

	/** @type {Awaited<ReturnType<typeof creditsBalance>>} */
	let balance = $state(null);
	let balanceError = $state('');
	/** @type {Awaited<ReturnType<typeof creditsPurchases>>} */
	let purchases = $state(null);
	let appPays = $state(false);
	let busy = $state(false);
	let error = $state('');
	let note = $state('');
	let choosing = $state(false);
	// The service's own list once it answered; until then the known one.
	let plans = $state(/** @type {{ id: string, hours: number, priceCredits: number }[]} */ ([...PLANS]));
	creditsCatalog().then((c) => c?.plans.length && (plans = c.plans)).catch(() => {});

	const euro = (/** @type {number} */ credits) => `${amount(credits / 100)} €`;
	const day = (/** @type {string | null} */ iso) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '');
	const current = $derived(balance?.plan ? planOf(balance.plan.id, plans) : null);
	const hoursLeft = $derived(balance?.plan?.hoursLeft == null ? null : Math.max(0, Math.floor(balance.plan.hoursLeft)));
	const share = $derived(current && hoursLeft != null ? Math.min(1, hoursLeft / current.hours) : null);

	async function read() {
		await Promise.all([
			creditsBalance(master).then((b) => ((balance = b), (balanceError = ''))).catch((e) => ((balance = null), (balanceError = e.message))),
			creditsPurchases(master).then((p) => (purchases = p)).catch(() => (purchases = null))
		]);
	}

	async function act(/** @type {() => Promise<string>} */ fn) {
		busy = true;
		error = note = '';
		try {
			note = await fn();
			choosing = false;
			await read();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
	const plan = (/** @type {string | null} */ id) => {
		if (id === null && !confirm('Paket zum Ende des Zeitraums beenden? Es wird nichts zurückerstattet.')) return;
		act(async () => {
			const r = await choosePlan(master, id);
			return id ? `Paket gewählt${r.periodEnd ? `, läuft bis ${day(r.periodEnd)}` : ''}.` : 'Das Paket endet mit dem Zeitraum.';
		});
	};
	const buyHours = (/** @type {number} */ hours) =>
		act(async () => {
			const r = await fundVm(master, hours);
			return `${hours} Stunden dazugekauft für ${euro(r.chargedCredits)}${r.expiration ? `, nutzbar bis ${day(r.expiration)}` : ''}.`;
		});

	// Again whenever the profile changed (setup, start, stop).
	$effect(() => {
		version;
		loadProfile(master)
			.then((p) => (appPays = Boolean(p.appPays)))
			.catch(() => {});
		read();
	});
</script>

<section class="card package" data-testid="package">
	<h2>Dein Paket</h2>
	{#if balance}
		{#if balance.plan}
			<p class="plan" data-testid="plan-current">
				<strong>{current ? `${current.hours} Stunden im Monat` : balance.plan.id}</strong>
				{#if current}<span class="hint">· {euro(current.priceCredits)} im Monat</span>{/if}
			</p>
			{#if hoursLeft != null}
				<div class="meter" role="meter" aria-valuemin="0" aria-valuemax={current?.hours ?? hoursLeft} aria-valuenow={hoursLeft} aria-label="Verbleibende Stunden">
					<span style="width: {(share ?? 1) * 100}%"></span>
				</div>
				<p class="hint" data-testid="plan-left">Noch {hoursLeft} {hoursLeft === 1 ? 'Stunde' : 'Stunden'}{balance.plan.periodEnd ? ` bis ${day(balance.plan.periodEnd)}` : ''}</p>
			{/if}
			{#if appPays}
				<p class="row"><span class="hint">Stunden dazukaufen:</span>
					{#each [5, 10, 30] as h (h)}<button class="chip" onclick={() => buyHours(h)} disabled={busy} data-testid={`buy-${h}`}>+{h} h</button>{/each}</p>
			{/if}
			<p class="row">
				<button class="link" onclick={() => (choosing = !choosing)} data-testid="plan-change">{choosing ? 'Doch nicht wechseln' : 'Paket wechseln'}</button>
				<button class="link" onclick={() => plan(null)} disabled={busy} data-testid="plan-end">Paket beenden</button>
			</p>
		{:else}
			<p class="hint" data-testid="plan-none">Noch kein Paket. Ein Paket gibt dir jeden Monat Stunden für dein Paperless; bezahlt wird aus deinem Guthaben.</p>
		{/if}
		{#if !balance.plan || choosing}
			<div class="plans">
				{#each plans as p (p.id)}
					<button class="plan-choice" class:current={balance.plan?.id === p.id} onclick={() => plan(p.id)} disabled={busy || balance.plan?.id === p.id} data-testid={`plan-${p.id}`}>
						<span>{p.hours} h im Monat</span><strong>{euro(p.priceCredits)}</strong>
					</button>
				{/each}
			</div>
		{/if}

		<div class="money">
			<p class="line"><span class="label">Guthaben</span> <strong data-testid="balance-euro">{euro(balance.credits)}</strong>
				{#if balance.reserved}<span class="hint">· davon {euro(balance.reserved)} für das laufende Paperless vorgemerkt</span>{/if}</p>
			<TopUp {master} credits={balance.credits} onbooked={read} />
		</div>

		{#if purchases?.length}
			<details class="purchases" data-testid="purchases">
				<summary>{purchases.length} Aufladung{purchases.length === 1 ? '' : 'en'}, mit Rechnung</summary>
				<ul>
					{#each purchases as p (p.id)}
						<li data-testid="purchase">{p.at ? new Date(p.at).toLocaleDateString('de-DE') : '–'} · {euro(p.cents)}
							{#if p.invoiceUrl}· <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">Rechnung</a>{:else}<small class="hint">· Rechnung folgt</small>{/if}</li>
					{/each}
				</ul>
			</details>
		{/if}
		{#if note}<p class="hint" role="status" data-testid="plan-note">{note}</p>{/if}
		{#if error}<p class="warn" role="alert" data-testid="plan-error">{error}</p>{/if}
	{:else if balanceError}
		<p class="warn">{balanceError}</p>
	{:else}
		<p class="hint">…</p>
	{/if}
</section>

<style>
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem; margin: 0 0 1rem; box-shadow: var(--shadow); }
	h2 { font-size: 1rem; margin: 0 0 0.75rem; }
	.plan { margin: 0 0 0.5rem; }
	.hint { color: var(--text-2); }
	.warn { color: var(--warn); }
	.meter { height: 8px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
	.meter span { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
	[data-testid='plan-left'] { margin: 0.35rem 0 0; font-size: 0.9rem; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.75rem; margin: 0.75rem 0 0; }
	.chip { padding: 0.3rem 0.8rem; font-size: 0.9rem; }
	.link { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; font-size: 0.9rem; }
	.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.5rem; margin: 0.75rem 0 0; }
	.plan-choice { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; padding: 0.7rem 0.9rem; border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); border-color: var(--line); text-align: left; }
	.plan-choice strong { font-size: 1.2rem; }
	.plan-choice.current { border-color: var(--accent); }
	.money { margin: 1.25rem 0 0; padding: 1rem 0 0; border-top: 1px solid var(--line); }
	.line { margin: 0 0 0.5rem; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem; }
	.label { color: var(--text-2); }
	.line strong { font-size: 1.2rem; }
	.purchases { margin: 0.75rem 0 0; font-size: 0.9rem; }
	.purchases summary { color: var(--text-2); }
	.purchases ul { list-style: none; padding: 0; margin: 0.3rem 0; }
</style>
