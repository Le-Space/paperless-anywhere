<script>
	// What a customer sees of money: the package, the balance in euros, topping
	// up and the invoices (Le Space Credits, belege#591). No crypto here: Aleph
	// credits, FIL and USDFC are under "Erweitert" (Balances).
	import { loadProfile } from '$lib/profile.js';
	import { amount } from '$lib/balances.js';
	import { creditsBalance, creditsCatalog, creditsPurchases, choosePlan, fundVm, planOf, PLANS, startSubscription, subscriptionPortal, waitForSubscription } from '$lib/credits.js';
	import StripeCheckout from '$lib/StripeCheckout.svelte';
	import TopUp from '$lib/TopUp.svelte';
	import Terms from '$lib/Terms.svelte';

	/** @type {{ master: Uint8Array, version?: number, onglance?: (g: { plan: boolean, hoursLeft: number | null, pays: string | null } | null) => void }} */
	let { master, version = 0, onglance = () => {} } = $props();

	/** @type {Awaited<ReturnType<typeof creditsBalance>>} */
	let balance = $state(null);
	let balanceError = $state('');
	/** @type {Awaited<ReturnType<typeof creditsPurchases>>} */
	let purchases = $state(null);
	let appPays = $state(false);
	// Who pays the running VM: the package (Le Space, model A), the app's own
	// address, or the person's wallet. Only for the package do its hours count.
	let pays = $state(/** @type {'lespace' | 'app' | 'wallet' | null} */ (null));
	let busy = $state(false);
	let error = $state('');
	let note = $state('');
	let choosing = $state(false);
	let purchasesError = $state('');
	// The actions stay folded until someone wants them; a short balance opens them.
	let moreOpen = $state(false);
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
			creditsPurchases(master).then((p) => ((purchases = p), (purchasesError = ''))).catch((e) => ((purchases = null), (purchasesError = e instanceof Error ? e.message : String(e))))
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
	/** @type {StripeCheckout | undefined} */
	let checkout = $state();
	// A package is a Stripe subscription: card, monthly invoice, cancel in the
	// portal. Until the service offers it (Stripe off, prices missing), the
	// package is paid from the balance as before.
	const subscribe = (/** @type {string} */ id) =>
		act(async () => {
			let secret;
			try {
				secret = await startSubscription(master, id);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				if (!/noch nicht fertig eingerichtet|gerade abgeschaltet|antwortet 404/.test(msg)) throw e;
				if (!confirm(`Das Abo per Karte geht gerade noch nicht (${msg}). Das Paket stattdessen aus deinem Guthaben bezahlen?`)) return '';
				const r = await choosePlan(master, id);
				return `Paket gewählt, aus dem Guthaben bezahlt${r.periodEnd ? `, läuft bis ${day(r.periodEnd)}` : ''}.`;
			}
			const outcome = await checkout?.pay(secret);
			if (outcome === 'closed') return 'Abo nicht abgeschlossen.';
			if (outcome === 'failed') throw new Error('Die Bezahlseite ließ sich nicht laden. Bitte später noch einmal.');
			note = 'Bezahlt – das Abo wird eingerichtet …';
			const { booked } = await waitForSubscription(master);
			return booked ? 'Abo abgeschlossen. Die Rechnung kommt von Stripe per E-Mail.' : 'Bezahlt; das Abo erscheint in Kürze.';
		});
	const portal = () =>
		act(async () => {
			location.href = await subscriptionPortal(master);
			return 'Stripe öffnet …';
		});
	const byStripe = $derived(balance?.plan?.billing === 'stripe');
	const buyHours = (/** @type {number} */ hours) =>
		act(async () => {
			const r = await fundVm(master, hours);
			return `${hours} Stunden dazugekauft für ${euro(r.chargedCredits)}${r.expiration ? `, nutzbar bis ${day(r.expiration)}` : ''}.`;
		});

	// Again whenever the profile changed (setup, start, stop).
	$effect(() => {
		version;
		loadProfile(master)
			.then((p) => {
				appPays = Boolean(p.appPays);
				pays = p.leSpacePays ? 'lespace' : p.appPays ? 'app' : p.payer ? 'wallet' : null;
			})
			.catch(() => {});
		read();
	});
	// What "Auf einen Blick" shows of the package.
	$effect(() => onglance(balance ? { plan: Boolean(balance.plan), hoursLeft, pays } : null));
</script>

<section class="card package" data-testid="package">
	{#if balance}
		<Terms {master} terms={balance.terms} onaccepted={read} />
		{#if balance.plan}
			<!-- One answer first: how long Paperless can run. Money and changes below. -->
			{#if pays === 'app' || pays === 'wallet'}
				<!-- The VM is not paid from the package: say what pays it, so 0 hours do not alarm. -->
				<p class="big" data-testid="plan-left"><strong>Paperless läuft über {pays === 'app' ? 'das Konto der App' : 'deine Wallet'}</strong></p>
				<p class="hint" data-testid="plan-source">Das Paket wird dafür nicht verbraucht{hoursLeft != null ? ` (darin ${hoursLeft} ${hoursLeft === 1 ? 'Stunde' : 'Stunden'})` : ''}. Es zählt erst, wenn du beim Start „Le Space, aus meinem Paket“ wählst. Was {pays === 'app' ? 'das Konto der App' : 'deine Wallet'} hält, steht unter „Erweitert“.</p>
			{:else}
				<p class="big" data-testid="plan-left">
					{#if hoursLeft != null}<strong>{hoursLeft} {hoursLeft === 1 ? 'Stunde' : 'Stunden'}</strong> Paperless übrig{balance.plan.periodEnd ? `, bis ${day(balance.plan.periodEnd)}` : ''}{:else}Paket aktiv{/if}
				</p>
			{/if}
			{#if pays !== 'app' && pays !== 'wallet' && hoursLeft != null && current && hoursLeft <= current.hours}
				<div class="meter" role="meter" aria-valuemin="0" aria-valuemax={current.hours} aria-valuenow={hoursLeft} aria-label="Verbleibende Stunden">
					<span style="width: {(share ?? 1) * 100}%"></span>
				</div>
			{/if}
			<p class="hint" data-testid="plan-current">
				{#if current && byStripe}Dein Abo: {current.hours} Stunden für {euro(current.priceCredits)} im Monat, per Karte über Stripe. {balance.plan.cancelAtPeriodEnd ? `Gekündigt, endet am ${day(balance.plan.renewsAt ?? balance.plan.periodEnd)}.` : `Es verlängert sich am ${day(balance.plan.renewsAt ?? balance.plan.periodEnd)}; jede Abbuchung mit Rechnung.`}{#if hoursLeft != null && hoursLeft > current.hours}{' '}Mehr übrig als im Paket, weil du Stunden dazugekauft hast.{/if}
				{:else if current}Dein Paket: {current.hours} Stunden für {euro(current.priceCredits)} im Monat. {balance.plan.periodEnd ? `Es verlängert sich am ${day(balance.plan.periodEnd)} und wird dann aus deinem Guthaben bezahlt, solange es reicht.` : 'Es verlängert sich monatlich und wird aus deinem Guthaben bezahlt, solange es reicht.'} Beenden kannst du es jederzeit zum Monatsende.{#if hoursLeft != null && hoursLeft > current.hours}{' '}Mehr übrig als im Paket, weil du Stunden dazugekauft hast.{/if}{:else}Paket {balance.plan.id}{/if}
			</p>
		{:else}
			<p class="big" data-testid="plan-none"><strong>Noch kein Paket</strong></p>
			<p class="hint">Ein Paket gibt dir jeden Monat Stunden für dein Paperless. Bezahlt wird aus deinem Guthaben.</p>
		{/if}

		<p class="line"><span class="label">Guthaben</span> <strong data-testid="balance-euro">{euro(balance.credits)}</strong>
			<span class="hint">{#if balance.reserved}davon {euro(balance.reserved)} für das laufende Paperless vorgemerkt · {/if}daraus werden Paket und Zusatzstunden bezahlt</span></p>

		{#if !balance.plan || choosing}
			<p class="hint">{balance.plan ? 'Neues Paket wählen:' : 'Paket als Monatsabo per Karte wählen (Stripe, jederzeit zum Monatsende kündbar):'}</p>
			<div class="plans">
				{#each plans as p (p.id)}
					<button class="plan-choice" class:current={balance.plan?.id === p.id} onclick={() => (balance?.plan ? plan(p.id) : subscribe(p.id))} disabled={busy || balance.plan?.id === p.id} data-testid={`plan-${p.id}`}>
						<span>{p.hours} Stunden im Monat</span><strong>{euro(p.priceCredits)}</strong>
					</button>
				{/each}
			</div>
		{/if}

		<details class="more" bind:open={moreOpen}>
			<summary>Aufladen, Stunden dazukaufen, Paket ändern</summary>
			<div class="group">
				<p class="label">Guthaben aufladen (per Karte)</p>
				<TopUp {master} credits={balance.credits} onbooked={read} />
			</div>
			{#if balance.plan && appPays}
				<div class="group">
					<p class="label">Mehr Stunden für diesen Monat, aus dem Guthaben</p>
					<p class="row">{#each [5, 10, 30] as h (h)}<button class="chip" onclick={() => buyHours(h)} disabled={busy} data-testid={`buy-${h}`}>+{h} Stunden</button>{/each}</p>
				</div>
			{/if}
			{#if balance.plan}
				<p class="row">
					{#if byStripe}
						<button class="link" onclick={portal} disabled={busy} data-testid="plan-portal">Abo verwalten (wechseln, Karte, Rechnungen)</button>
						<button class="link" onclick={portal} disabled={busy} data-testid="plan-cancel">Verträge hier kündigen</button>
					{:else}
						<button class="link" onclick={() => (choosing = !choosing)} data-testid="plan-change">{choosing ? 'Doch nicht wechseln' : 'Paket wechseln'}</button>
						<button class="link" onclick={() => plan(null)} disabled={busy} data-testid="plan-end">Paket beenden</button>
					{/if}
				</p>
			{/if}
			<!-- Always there, so the invoices are found: the list, or why it is empty. -->
			<details class="purchases" data-testid="purchases">
				<summary>Aufladungen und Rechnungen{purchases?.length ? ` (${purchases.length})` : ''}</summary>
				{#if purchasesError}<p class="warn">Die Aufladungen ließen sich gerade nicht lesen: {purchasesError}</p>
				{:else if purchases === null}<p class="hint">…</p>
				{:else if !purchases.length}<p class="hint">Noch keine Aufladung.</p>
				{:else}
					<ul>
						{#each purchases as p (p.id)}
							<li data-testid="purchase">{p.at ? new Date(p.at).toLocaleDateString('de-DE') : '–'} · {euro(p.cents)}
								{#if p.invoiceUrl}· <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">Rechnung (Stripe)</a>{:else}<small class="hint">· Rechnung folgt</small>{/if}</li>
						{/each}
					</ul>
				{/if}
			</details>
		</details>
		{#if note}<p class="hint" role="status" data-testid="plan-note">{note}</p>{/if}
		{#if error}<p class="warn" role="alert" data-testid="plan-error">{error}</p>{/if}
	{:else if balanceError}
		<p class="warn">{balanceError}</p>
	{:else}
		<p class="hint">…</p>
	{/if}
</section>
<StripeCheckout bind:this={checkout} label="Abo abschließen" />

<style>
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem; margin: 0 0 1rem; box-shadow: var(--shadow); }
	h2 { font-size: 1rem; margin: 0 0 0.75rem; }
	.big { margin: 0 0 0.5rem; font-size: 1.15rem; }
	.big strong { font-size: 1.6rem; letter-spacing: -0.02em; }
	.hint { color: var(--text-2); }
	.warn { color: var(--warn); }
	.meter { height: 8px; border-radius: 999px; background: var(--surface-2); overflow: hidden; margin: 0 0 0.5rem; }
	.meter span { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.75rem; margin: 0.5rem 0 0; }
	.chip { padding: 0.3rem 0.8rem; font-size: 0.9rem; }
	.link { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; font-size: 0.9rem; }
	.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.5rem; margin: 0.5rem 0 0; }
	.plan-choice { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; padding: 0.7rem 0.9rem; border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); border-color: var(--line); text-align: left; }
	.plan-choice strong { font-size: 1.2rem; }
	.plan-choice.current { border-color: var(--accent); }
	.line { margin: 1rem 0 0; padding: 0.9rem 0 0; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.6rem; }
	.label { color: var(--text-2); margin: 0; }
	.line strong { font-size: 1.2rem; }
	.line .hint { font-size: 0.85rem; flex-basis: 100%; }
	.more { margin: 0.75rem 0 0; }
	.more summary { color: var(--text-2); cursor: pointer; }
	.group { margin: 0.75rem 0 0; }
	.purchases { margin: 0.75rem 0 0; font-size: 0.9rem; }
	.purchases summary { color: var(--text-2); }
	.purchases ul { list-style: none; padding: 0; margin: 0.3rem 0; }
</style>
