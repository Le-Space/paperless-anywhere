<script>
	// What a customer sees of money: the package, the balance in euros, topping
	// up and the invoices (Le Space Credits, belege#591). No crypto here: Aleph
	// credits, FIL and USDFC are under "Erweitert" (Balances).
	import { loadProfile } from '$lib/profile.js';
	import { biggerPlan, planHours, creditsBalance, creditsCatalog, fewHoursLeft, hoursPerWeek, creditsPurchases, choosePlan, fundVm, planOf, PLANS, quoteVm, startSubscription, subscriptionPortal, waitForSubscription, creditsTerms, waiverOf, WaiverError } from '$lib/credits.js';
	import StripeCheckout from '$lib/StripeCheckout.svelte';
	import Cancel from '$lib/Cancel.svelte';
	import Withdraw from '$lib/Withdraw.svelte';
	import BackupLine from '$lib/BackupLine.svelte';
	import { withdrawalQuote } from '$lib/credits.js';
	import Waiver from '$lib/Waiver.svelte';
	import TopUp from '$lib/TopUp.svelte';
	import Terms from '$lib/Terms.svelte';
	import HourQuote from '$lib/HourQuote.svelte';
	import { hourPurchase, purchaseLocked } from '$lib/purchase.js';

	/** @type {{ master: Uint8Array, version?: number, onglance?: (g: { plan: boolean, hoursLeft: number | null, pays: string | null, low: boolean } | null) => void }} */
	let { master, version = 0, onglance = () => {} } = $props();

	/** @type {Awaited<ReturnType<typeof creditsBalance>>} */
	let balance = $state(null);
	let balanceError = $state('');
	/** @type {Awaited<ReturnType<typeof creditsPurchases>>} */
	let purchases = $state(null);
	let appPays = $state(false);
	let ownBackups = $state(false);
	// Someone who pays the VM themselves and has no package: the card is one
	// line until they want to see Le Space's offer; the terms are asked for only there.
	let selfOpen = $state(false);
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
	let plans = $state(/** @type {{ id: string, hours: number, priceCredits: number, backupIncluded?: boolean }[]} */ ([...PLANS]));
	// What the service sells of backups beside the plan (le-space-credits#69).
	/** @type {ReturnType<typeof import('$lib/credits.js').backupOfferOf>} */
	let backupOffer = $state(null);
	creditsCatalog()
		.then((c) => {
			if (c?.plans.length) plans = c.plans;
			backupOffer = c?.backup ?? null;
		})
		.catch(() => {});
	// "mit Sicherung" at the plan choice: an extra that costs money, so it
	// starts unticked (§ 312a Abs. 3 BGB) and is never set by the app.
	let withBackup = $state(false);
	const backupSold = $derived(Boolean(backupOffer?.planOffered));
	// A package whose price includes the backup (le-space-credits#72): nothing
	// to tick and nothing to add. The box is left for packages without it.
	const included = (/** @type {{ backupIncluded?: boolean } | null | undefined} */ p) => p?.backupIncluded === true;
	const boxOffered = $derived(backupSold && plans.some((p) => !included(p)));
	const allIncluded = $derived(plans.length > 0 && plans.every(included));
	const planTotal = (/** @type {{ priceCredits: number, backupIncluded?: boolean }} */ p) => p.priceCredits + (!included(p) && withBackup && backupSold && backupOffer ? backupOffer.monthCents : 0);
	const includedText = $derived(`Sicherung inklusive${backupOffer ? `: ${backupOffer.copies ? `${backupOffer.copies} verschlüsselte Kopien` : 'verschlüsselte Kopien'}${backupOffer.quotaGib ? `, bis ${backupOffer.quotaGib} GiB` : ''}, nach dem Ende noch ${backupOffer.retentionDays} Tage abrufbar` : ''}.`);
	let ordering = $state('');
	// The declaration on withdrawal before a payment (le-space-credits#51):
	// null from an older service, which then gets no checkbox and no waiver.
	// The pay buttons wait until the terms were read.
	/** @type {{ version: string, de: string, en: string } | null} */
	let withdrawal = $state(null);
	let termsRead = $state(false);
	const readWithdrawal = () =>
		creditsTerms()
			.then((t) => (withdrawal = t?.withdrawal ?? null))
			.catch(() => (withdrawal = null))
			.finally(() => (termsRead = true));
	readWithdrawal();
	// Unticked for every subscription: it is the declaration for this one.
	let waivedPlan = $state(false);
	const planBlocked = $derived(!termsRead || (Boolean(withdrawal) && !waivedPlan));
	// The app's own cancel page, open in place (§ 312k BGB). It keeps the plan
	// it was opened for, so the confirmation stays when the balance changes.
	/** @type {{ plan: NonNullable<NonNullable<typeof balance>['plan']>, current: typeof current } | null} */
	let cancelling = $state(null);

	// The withdrawal function (§ 356a BGB): what the service lists as
	// withdrawable right now. Empty, or a service without the route: no button.
	/** @type {Awaited<ReturnType<typeof withdrawalQuote>>} */
	let withdrawable = $state([]);
	let withdrawing = $state(false);

	// Prices and balances always with cents: "4,90 €", never "4,9 €".
	const euro = (/** @type {number} */ credits) => `${(credits / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
	const day = (/** @type {string | null} */ iso) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '');
	const current = $derived(balance?.plan ? planOf(balance.plan.id, plans) : null);
	const hoursLeft = $derived(balance?.plan?.hoursLeft == null ? null : Math.max(0, Math.floor(balance.plan.hoursLeft)));
	// Few hours left in a package that is in use: say so, and name the next
	// larger package as the recommendation.
	const usesPackage = $derived(pays !== 'app' && pays !== 'wallet');
	const selfPays = $derived((pays === 'app' || pays === 'wallet') && !balance?.plan);
	const low = $derived(usesPackage && fewHoursLeft(hoursLeft, current));
	const bigger = $derived(biggerPlan(current, plans));
	const recommended = $derived(low && bigger ? bigger.id : null);
	const perWeek = (/** @type {number} */ hours) => `≈ ${hoursPerWeek(hours)} h pro Woche`;
	const share = $derived(current && hoursLeft != null ? Math.min(1, hoursLeft / current.hours) : null);

	async function read() {
		await Promise.all([
			creditsBalance(master).then((b) => ((balance = b), (balanceError = ''))).catch((e) => ((balance = null), (balanceError = e.message))),
			creditsPurchases(master).then((p) => ((purchases = p), (purchasesError = ''))).catch((e) => ((purchases = null), (purchasesError = e instanceof Error ? e.message : String(e)))),
			// While the withdrawal view is open its list stays as it was opened.
			withdrawing ? null : withdrawalQuote(master).then((w) => (withdrawable = w)).catch(() => (withdrawable = []))
		]);
	}

	let justBought = $state(false);
	async function act(/** @type {() => Promise<string>} */ fn) {
		busy = true;
		justBought = false;
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
			const waiver = waiverOf(withdrawal, waivedPlan);
			waivedPlan = false;
			const chosen = planOf(id, plans);
			const backup = !included(chosen) && withBackup && backupSold;
			// Plan, backup, total and the renewal in one line above the Checkout.
			ordering = chosen ? `${planHours(chosen)} im Monat: ${euro(chosen.priceCredits)}${included(chosen) ? ', Sicherung inklusive' : backup && backupOffer ? ` + Sicherung ${euro(backupOffer.monthCents)} = ${euro(chosen.priceCredits + backupOffer.monthCents)}` : backupSold ? ', ohne Sicherung' : ''}. Monatsabo, verlängert sich jeden Monat, kündbar zum Monatsende.` : '';
			try {
				secret = await startSubscription(master, id, { ...waiver, backup });
			} catch (e) {
				if (e instanceof WaiverError) {
					readWithdrawal();
					throw e;
				}
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
	// Extra hours: a quote first, the confirmation shows it, and only its
	// button buys – once (purchase.js). act() then re-reads the balance.
	/** @type {import('$lib/purchase.js').PurchaseState} */
	let buying = $state({ phase: 'idle', hours: null, quote: null, error: '' });
	const purchase = hourPurchase({
		quote: (hours) => quoteVm(master, hours),
		buy: async (hours) => {
			await act(async () => {
				const r = await fundVm(master, hours);
				return `${hours} Stunden dazugekauft für ${euro(r.chargedCredits)}${r.expiration ? `, nutzbar bis ${day(r.expiration)}` : ''}.`;
			});
			justBought = !error;
		},
		onchange: (s) => (buying = s),
		// An older service may have bought on the quote: show what the balance is now.
		onquotefailed: () => read()
	});
	const buyHours = (/** @type {number} */ hours) => {
		error = note = '';
		purchase.ask(hours);
	};
	// What the balance and the package's hours are after a purchase.
	const after = $derived(balance ? `Guthaben jetzt ${euro(balance.credits)}${hoursLeft != null ? `, ${hoursLeft} ${hoursLeft === 1 ? 'Stunde' : 'Stunden'} im Paket` : ''}.` : '');

	// Again whenever the profile changed (setup, start, stop).
	$effect(() => {
		version;
		loadProfile(master)
			.then((p) => {
				appPays = Boolean(p.appPays);
				// Backups set up and paid from the person's own wallet: nothing of Le Space's to book.
				ownBackups = Boolean(p.backupConfig && !p.backupsByCredits);
				pays = p.leSpacePays ? 'lespace' : p.appPays ? 'app' : p.payer ? 'wallet' : null;
			})
			.catch(() => {});
		read();
	});
	// What "Auf einen Blick" shows of the package.
	$effect(() => onglance(balance ? { plan: Boolean(balance.plan), hoursLeft, pays, low } : null));
</script>

<!-- The card's content: as it is for a customer of Le Space, folded for someone who pays the providers themselves. -->
{#snippet content()}
	{#if balance}
		<Terms {master} terms={balance.terms} onaccepted={read} />
		{#if balance.plan}
			<!-- One answer first: how long Paperless can run. Money and changes below. -->
			{#if pays === 'app' || pays === 'wallet'}
				<!-- The VM is not paid from the package: say what pays it, so 0 hours do not alarm. -->
				<p class="big" data-testid="plan-left"><strong>Paperless anywhere läuft über {pays === 'app' ? 'die Adresse der App' : 'deine Wallet'}</strong></p>
				<p class="hint" data-testid="plan-source">Das Paket wird dafür nicht verbraucht{hoursLeft != null ? ` (darin ${hoursLeft} ${hoursLeft === 1 ? 'Stunde' : 'Stunden'})` : ''}. Es zählt erst, wenn du beim Start „Le Space, aus meinem Paket“ wählst. Was {pays === 'app' ? 'die Adresse der App' : 'deine Wallet'} hält, steht unter „Erweitert“.</p>
			{:else}
				<p class="big" data-testid="plan-left">
					{#if hoursLeft != null}<strong>{hoursLeft} {hoursLeft === 1 ? 'Stunde' : 'Stunden'}</strong> Laufzeit übrig{balance.plan.periodEnd ? `, bis ${day(balance.plan.periodEnd)}` : ''}{:else}Paket aktiv{/if}
				</p>
			{/if}
			{#if pays !== 'app' && pays !== 'wallet' && hoursLeft != null && current && hoursLeft <= current.hours}
				<div class="meter" role="meter" aria-valuemin="0" aria-valuemax={current.hours} aria-valuenow={hoursLeft} aria-label="Verbleibende Stunden">
					<span style="width: {(share ?? 1) * 100}%"></span>
				</div>
			{/if}
			{#if low}
				<div class="low" role="status" data-testid="plan-low">
					<p>Nur noch {hoursLeft} {hoursLeft === 1 ? 'Stunde' : 'Stunden'} in diesem Monat. Reicht das nicht, nimm ein größeres Paket{appPays ? ' oder kauf Stunden dazu' : ''}.</p>
					{#if bigger}<button class="upgrade" onclick={() => (byStripe ? portal() : plan(bigger.id))} disabled={busy} data-testid="plan-upgrade">{bigger.hours >= 720 ? 'Dauerbetrieb' : `${bigger.hours} Stunden im Monat`} für {euro(bigger.priceCredits)}</button>{/if}
				</div>
			{/if}
			<p class="hint" data-testid="plan-current">
				{#if current && byStripe}Dein Abo: {planHours(current)} für {euro(current.priceCredits)} im Monat, per Karte über Stripe. {balance.plan.cancelAtPeriodEnd ? `Gekündigt, endet am ${day(balance.plan.renewsAt ?? balance.plan.periodEnd)}.` : `Es verlängert sich am ${day(balance.plan.renewsAt ?? balance.plan.periodEnd)}; jede Abbuchung mit Rechnung.`}{#if hoursLeft != null && hoursLeft > current.hours}{' '}Mehr übrig als im Paket, weil du Stunden dazugekauft hast.{/if}
				{:else if current}Dein Paket: {planHours(current)} für {euro(current.priceCredits)} im Monat. {balance.plan.periodEnd ? `Es verlängert sich am ${day(balance.plan.periodEnd)} und wird dann aus deinem Guthaben bezahlt, solange es reicht.` : 'Es verlängert sich monatlich und wird aus deinem Guthaben bezahlt, solange es reicht.'} Beenden kannst du es jederzeit zum Monatsende.{#if hoursLeft != null && hoursLeft > current.hours}{' '}Mehr übrig als im Paket, weil du Stunden dazugekauft hast.{/if}{:else}Paket {balance.plan.id}{/if}
			</p>
			{#if byStripe && !cancelling}
				<!-- The cancel button (§ 312k BGB): always in sight, no fold, no portal. -->
				<p class="row"><button class="small" onclick={() => balance?.plan && (cancelling = { plan: balance.plan, current })} disabled={busy} data-testid="plan-cancel">Verträge hier kündigen</button></p>
			{/if}
		{:else}
			<p class="big" data-testid="plan-none"><strong>Noch kein Paket</strong></p>
			<p class="hint">Ein Paket gibt dir jeden Monat Stunden für dein Paperless anywhere. Bezahlt wird aus deinem Guthaben.</p>
		{/if}

		{#if cancelling}
			<Cancel {master} plan={cancelling.plan} current={cancelling.current} onportal={portal} ondone={read} onclose={() => (cancelling = null)} />
		{/if}

		{#if withdrawable.length && !withdrawing}
			<!-- The withdrawal button (§ 356a BGB): in sight for as long as something can be withdrawn. -->
			<p class="row"><button class="small" onclick={() => (withdrawing = true)} disabled={busy} data-testid="withdraw-open">Vertrag widerrufen</button></p>
		{/if}
		{#if withdrawing}
			<Withdraw {master} {withdrawable} ondone={read} onclose={() => { withdrawing = false; read(); }} />
		{/if}

		{#if balance.backup}
			<BackupLine {master} backup={balance.backup} own={ownBackups} offer={backupOffer} plan={balance.plan} included={included(current)} {withdrawal} {termsRead} disabled={busy} onchanged={read} onportal={portal} onwaiver={readWithdrawal} />
		{/if}

		<p class="line"><span class="label">Guthaben</span> <strong data-testid="balance-euro">{euro(balance.credits)}</strong>
			<span class="hint">{#if balance.reserved}davon {euro(balance.reserved)} für die laufende Instanz vorgemerkt · {/if}daraus werden Paket und Zusatzstunden bezahlt</span></p>

		{#if !balance.plan || choosing}
			<p class="hint">{balance.plan ? 'Neues Paket wählen:' : 'Paket als Monatsabo per Karte wählen (Stripe, jederzeit zum Monatsende kündbar):'}</p>
			{#if !balance.plan && allIncluded}
				<p class="hint" data-testid="plan-backup-included">{includedText}</p>
			{:else if !balance.plan && boxOffered && backupOffer}
				<label class="with-backup" data-testid="plan-backup">
					<input type="checkbox" bind:checked={withBackup} data-testid="plan-backup-box" />
					<span><strong>mit Sicherung</strong> (+ {euro(backupOffer.monthCents)} im Monat){#if backupOffer.copies}: {backupOffer.copies} verschlüsselte Kopien deiner Dokumente{/if}
						<br /><small class="hint">Ohne Sicherung sind deine Dokumente nach einem Stopp weg. Hinzubuchen geht auch später, hier in der App.</small></span>
				</label>
			{/if}
			{#if !balance.plan}<Waiver {withdrawal} bind:checked={waivedPlan} testid="plan-waiver" />{/if}
			<div class="plans">
				{#each plans as p (p.id)}
					<button class="plan-choice" class:current={balance.plan?.id === p.id} onclick={() => (balance?.plan ? plan(p.id) : subscribe(p.id))} disabled={busy || balance.plan?.id === p.id || (!balance.plan && planBlocked)} data-testid={`plan-${p.id}`}>
						{#if recommended === p.id}<em class="badge">Empfehlung</em>{/if}
						<span>{p.hours >= 720 ? 'Dauerbetrieb, rund um die Uhr' : `${p.hours} Stunden im Monat`}</span><strong data-testid={`plan-price-${p.id}`}>{euro(balance.plan ? p.priceCredits : planTotal(p))}</strong><small class="hint">{perWeek(p.hours)}{included(p) ? ' · Sicherung inklusive' : !balance.plan && withBackup && backupSold ? ' · mit Sicherung' : ''}</small>
					</button>
				{/each}
			</div>
		{/if}

		<details class="more" bind:open={moreOpen}>
			<summary>Aufladen, Stunden dazukaufen, Paket ändern</summary>
			<div class="group">
				<p class="label">Guthaben aufladen (per Karte)</p>
				<TopUp {master} credits={balance.credits} {withdrawal} ready={termsRead} onbooked={read} onwaiver={readWithdrawal} />
			</div>
			{#if balance.plan && appPays}
				<div class="group">
					<p class="label">Mehr Stunden für diesen Monat, aus dem Guthaben</p>
					<p class="row">{#each [5, 10, 30] as h (h)}<button class="chip" onclick={() => buyHours(h)} disabled={busy || purchaseLocked(buying)} data-testid={`buy-${h}`}>{buying.phase === 'quoting' && buying.hours === h ? 'Preis …' : `+${h} Stunden`}</button>{/each}</p>
					<HourQuote quote={buying.phase === 'open' ? buying.quote : null} short={buying.phase === 'short'} hoursAsked={buying.hours} topUpHint="Erst Guthaben aufladen (oben, per Karte), dann noch einmal kaufen." confirmLabel="Kaufen" disabled={busy || buying.phase === 'buying'} onconfirm={() => purchase.confirm()} oncancel={() => purchase.cancel()} />
					{#if buying.error}<p class="warn" role="alert" data-testid="buy-error">{buying.error}</p>{/if}
				</div>
			{/if}
			{#if balance.plan}
				<p class="row">
					{#if byStripe}
						<button class="link" onclick={portal} disabled={busy} data-testid="plan-portal">Abo verwalten (wechseln, Karte, Rechnungen)</button>
					{:else}
						<button class="link" onclick={() => (choosing = !choosing)} data-testid="plan-change">{choosing ? 'Doch nicht wechseln' : 'Paket wechseln'}</button>
						<button class="link" onclick={() => plan(null)} disabled={busy} data-testid="plan-end">Paket beenden</button>
					{/if}
				</p>
			{/if}
		</details>
		<!-- Always there and outside the fold, so the invoices are found: the list,
		     or why it is empty; the subscription's own invoices are at Stripe. -->
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
			{#if byStripe}<p><button class="link" onclick={portal} disabled={busy} data-testid="purchases-portal">Rechnungen des Abos bei Stripe</button></p>{/if}
		</details>
		{#if note}<p class="hint" role="status" data-testid="plan-note">{note}</p>{/if}
		{#if justBought && after}<p class="hint" data-testid="buy-after">{after}</p>{/if}
		{#if error}<p class="warn" role="alert" data-testid="plan-error">{error}</p>{/if}
	{/if}
{/snippet}

<section class="card package" data-testid="package">
	{#if balance && selfPays}
		<details class="self" bind:open={selfOpen} data-testid="package-self">
			<summary><strong>Du zahlst die Anbieter selbst.</strong> <span class="hint">Pakete von Le Space ansehen</span></summary>
			<p class="hint">{pays === 'app' ? 'Die Adresse der App' : 'Deine Wallet'} bezahlt die VM bei Aleph direkt; ein Paket brauchst du dafür nicht. Ein Paket von Le Space ist der Weg ohne Wallet und ohne Kryptowerte.</p>
			{@render content()}
		</details>
	{:else if balance}
		{@render content()}
	{:else if balanceError}
		<p class="warn">{balanceError}</p>
	{:else}
		<p class="hint">…</p>
	{/if}
</section>
<StripeCheckout bind:this={checkout} label="Abo abschließen" summary={ordering} />

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
	.low { margin: 0.5rem 0; padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); background: var(--warn-bg); color: var(--warn); }
	.low p { margin: 0 0 0.5rem; }
	.upgrade { padding: 0.5rem 1rem; font-weight: 600; }
	.plan-choice small { font-size: 0.8rem; }
	.self > summary { cursor: pointer; }
	.self[open] > summary { margin-bottom: 0.75rem; }
	.with-backup { display: flex; gap: 0.5rem; align-items: flex-start; margin: 0.5rem 0; }
	.with-backup input { width: auto; margin-top: 0.25rem; flex: none; }
	.badge { font-style: normal; font-size: 0.75rem; font-weight: 600; padding: 0.05rem 0.5rem; border-radius: 999px; background: var(--accent); color: var(--cta-text, #0f1b2d); }
	.purchases summary { color: var(--text-2); }
	.purchases ul { list-style: none; padding: 0; margin: 0.3rem 0; }
</style>
