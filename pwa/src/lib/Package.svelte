<script>
	import RefreshBalances from '$lib/RefreshBalances.svelte';
	import StripeCheckout from '$lib/StripeCheckout.svelte';
	import Cancel from '$lib/Cancel.svelte';
	import Withdraw from '$lib/Withdraw.svelte';
	import BackupLine from '$lib/BackupLine.svelte';
	import Waiver from '$lib/Waiver.svelte';
	import TopUp from '$lib/TopUp.svelte';
	import Terms from '$lib/Terms.svelte';
	import HourQuote from '$lib/HourQuote.svelte';
	import { createPackageCard } from '$lib/package-card.svelte.js';
	import { planHours, planOf } from '$lib/credits.js';
	import { purchaseLocked } from '$lib/purchase.js';
	import { format, lang, t } from '$lib/i18n/index.js';

	/** @type {{ master: Uint8Array, version?: number, onglance?: (g: { plan: boolean, hoursLeft: number | null, pays: string | null, low: boolean, endsAt: number | null } | null) => void }} */
	let { master, version = 0, onglance = () => {}, onprofile = () => {} } = $props();

	// What happens is in package-card.svelte.js; this component draws it.
	const k = createPackageCard({
		get master() { return master; },
		get version() { return version; },
		onglance: (...a) => onglance(...a),
		onprofile: (...a) => onprofile(...a)
	});
	const { included, planTotal, readWithdrawal, pickPlan, dropPlan, payPlan, euro, day, perWeek, read, plan, portal, longDay, redeem, purchase, buyHours } = k;
	const balance = $derived(k.balance);
	const balanceError = $derived(k.balanceError);
	const purchases = $derived(k.purchases);
	const appPays = $derived(k.appPays);
	const ownBackups = $derived(k.ownBackups);
	const selfOpen = $derived(k.selfOpen);
	const pays = $derived(k.pays);
	const busy = $derived(k.busy);
	const error = $derived(k.error);
	const note = $derived(k.note);
	const choosing = $derived(k.choosing);
	const purchasesError = $derived(k.purchasesError);
	const moreOpen = $derived(k.moreOpen);
	const plans = $derived(k.plans);
	const backupOffer = $derived(k.backupOffer);
	const withBackup = $derived(k.withBackup);
	const voucherOffered = $derived(k.voucherOffered);
	const voucherInput = $derived(k.voucherInput);
	const backupSold = $derived(k.backupSold);
	const boxOffered = $derived(k.boxOffered);
	const allIncluded = $derived(k.allIncluded);
	const x = $derived(k.x);
	const includedText = $derived(k.includedText);
	const ordering = $derived(k.ordering);
	const withdrawal = $derived(k.withdrawal);
	const termsRead = $derived(k.termsRead);
	const waivedPlan = $derived(k.waivedPlan);
	const planBlocked = $derived(k.planBlocked);
	const pickedPlan = $derived(k.pickedPlan);
	const cancelling = $derived(k.cancelling);
	const withdrawable = $derived(k.withdrawable);
	const withdrawing = $derived(k.withdrawing);
	const current = $derived(k.current);
	const hoursLeft = $derived(k.hoursLeft);
	const selfPays = $derived(k.selfPays);
	const low = $derived(k.low);
	const bigger = $derived(k.bigger);
	const recommended = $derived(k.recommended);
	const share = $derived(k.share);
	const justBought = $derived(k.justBought);
	const checkout = $derived(k.checkout);
	const byStripe = $derived(k.byStripe);
	const byVoucher = $derived(k.byVoucher);
	const voucherBackup = $derived(k.voucherBackup);
	const buying = $derived(k.buying);
	const after = $derived(k.after);
	const endsAt = $derived(k.endsAt);
	const ending = $derived(k.ending);
</script>

<!-- The card's content: as it is for a customer of Le Space, folded for someone who pays the providers themselves. -->
{#snippet content()}
	{#if balance}
		<Terms {master} terms={balance.terms} onaccepted={read} />
		{#if balance.plan}
			<!-- One answer first: how long Paperless can run. Money and changes below. -->
			{#if pays === 'app' || pays === 'wallet'}
				<!-- The VM is not paid from the package: say what pays it, so 0 hours do not alarm. -->
				<p class="big" data-testid="plan-left"><strong>{x.runsOver(pays)}</strong></p>
				<p class="hint" data-testid="plan-source">{x.notUsed(hoursLeft != null ? x.hours(hoursLeft) : null, pays)}</p>
			{:else}
				<p class="big" data-testid="plan-left">
					{#if hoursLeft != null}<strong>{x.hours(hoursLeft)}</strong> {x.left}{balance.plan.periodEnd ? x.until(day(balance.plan.periodEnd)) : ''}{:else}{x.active}{/if}
				</p>
			{/if}
			{#if pays !== 'app' && pays !== 'wallet' && hoursLeft != null && current && hoursLeft <= current.hours}
				<div class="meter" role="meter" aria-valuemin="0" aria-valuemax={current.hours} aria-valuenow={hoursLeft} aria-label={x.meter}>
					<span style="width: {(share ?? 1) * 100}%"></span>
				</div>
			{/if}
			{#if ending && endsAt != null}
				<div class="low" role="alert" data-testid="plan-ending">
					<p><strong>{x.ending[ending](format.dateTime(endsAt, undefined, $lang))}</strong> {x.ending.what}</p>
				</div>
			{/if}
			{#if low}
				<div class="low" role="status" data-testid="plan-low">
					<p>{x.low(x.hours(hoursLeft ?? 0), appPays)}</p>
					{#if bigger}<button class="upgrade" onclick={() => (byStripe ? portal() : plan(bigger.id))} disabled={busy} data-testid="plan-upgrade">{x.upgrade(bigger.hours, bigger.hours >= 720, euro(bigger.priceCredits))}</button>{/if}
				</div>
			{/if}
			<p class="hint" data-testid="plan-current">
				{#if byVoucher}<span data-testid="voucher-period">{x.voucher.period(longDay(balance.plan.periodEnd))}</span> {x.voucher.periodEnds}
				{:else if current && byStripe}{x.yourSubscription(planHours(current), euro(current.priceCredits))} {balance.plan.cancelAtPeriodEnd ? x.cancelledEnds(day(balance.plan.renewsAt ?? balance.plan.periodEnd)) : x.renewsInvoice(day(balance.plan.renewsAt ?? balance.plan.periodEnd))}{#if hoursLeft != null && hoursLeft > current.hours}{' '}{x.moreThanPackage}{/if}
				{:else if current}{x.yourPackage(planHours(current), euro(current.priceCredits))} {x.renewsFromBalance(day(balance.plan.periodEnd))} {x.endAnyMonth}{#if hoursLeft != null && hoursLeft > current.hours}{' '}{x.moreThanPackage}{/if}{:else}{x.packageId(balance.plan.id)}{/if}
			</p>
			{#if byStripe && !cancelling}
				<!-- The cancel button (§ 312k BGB): always in sight, no fold, no portal. -->
				<p class="row"><button class="small" onclick={() => balance?.plan && (k.cancelling = { plan: balance.plan, current })} disabled={busy} data-testid="plan-cancel">{x.legal.cancel}</button></p>
			{/if}
		{:else}
			<p class="big" data-testid="plan-none"><strong>{x.none}</strong></p>
			<p class="hint" data-testid="plan-none-hint">{x.noneHint}</p>
		{/if}

		{#if cancelling}
			<Cancel {master} plan={cancelling.plan} current={cancelling.current} onportal={portal} ondone={read} onclose={() => (k.cancelling = null)} />
		{/if}

		{#if withdrawable.length && !withdrawing}
			<!-- The withdrawal button (§ 356a BGB): in sight for as long as something can be withdrawn. -->
			<p class="row"><button class="small" onclick={() => (k.withdrawing = true)} disabled={busy} data-testid="withdraw-open">{x.legal.withdraw}</button></p>
		{/if}
		{#if withdrawing}
			<Withdraw {master} {withdrawable} ondone={read} onclose={() => { k.withdrawing = false; read(); }} />
		{/if}

		{#if balance.backup}
			<BackupLine {master} backup={voucherBackup ?? balance.backup} own={ownBackups} offer={backupOffer} plan={balance.plan} included={included(current)} {withdrawal} {termsRead} disabled={busy} onchanged={read} onportal={portal} onwaiver={readWithdrawal} />
		{/if}

		<p class="line"><span class="label">{x.balance}</span> <strong data-testid="balance-euro">{euro(balance.credits)}</strong>
			<span class="hint">{#if balance.reserved}{x.reserved(euro(balance.reserved))}{/if}{x.balanceUse}</span> <RefreshBalances testid="package-refresh" /></p>

		{#if !balance.plan || choosing}
			{#if !balance.plan && voucherOffered}
				<!-- Before the plans: someone holding a code is not here to buy. -->
				<details class="voucher" data-testid="voucher">
					<summary>{x.voucher.fold}</summary>
					<p class="hint">{x.voucher.hint}</p>
					<form class="row" onsubmit={(e) => { e.preventDefault(); redeem(); }}>
						<label>{x.voucher.label} <input bind:value={k.voucherInput} placeholder={x.voucher.placeholder} autocomplete="off" autocapitalize="characters" spellcheck="false" data-testid="voucher-code" /></label>
						<button class="small" type="submit" disabled={busy || !voucherInput.trim()} data-testid="voucher-redeem">{x.voucher.button}</button>
					</form>
				</details>
			{/if}
			<p class="hint">{balance.plan ? x.chooseNew : x.chooseFirst}</p>
			{#if !balance.plan && allIncluded}
				<p class="hint" data-testid="plan-backup-included">{includedText}</p>
			{:else if !balance.plan && boxOffered && backupOffer}
				<label class="with-backup" data-testid="plan-backup">
					<input type="checkbox" bind:checked={k.withBackup} data-testid="plan-backup-box" />
					<span><strong>{x.withBackup}</strong> {x.withBackupPrice(euro(backupOffer.monthCents))}{#if backupOffer.copies}{x.withBackupCopies(backupOffer.copies)}{/if}
						<br /><small class="hint">{x.withBackupHint}</small></span>
				</label>
			{/if}
			<div class="plans">
				{#each plans as p (p.id)}
					<button class="plan-choice" class:current={balance.plan?.id === p.id} class:picked={!balance.plan && pickedPlan === p.id} aria-pressed={balance.plan ? undefined : pickedPlan === p.id} onclick={() => (balance?.plan ? plan(p.id) : pickPlan(p.id))} disabled={busy || balance.plan?.id === p.id || (!balance.plan && !termsRead)} data-testid={`plan-${p.id}`}>
						{#if recommended === p.id}<em class="badge">{x.recommended}</em>{/if}
						<span>{x.planName(p.hours, p.hours >= 720)}</span><strong data-testid={`plan-price-${p.id}`}>{euro(balance.plan ? p.priceCredits : planTotal(p))}</strong><small class="hint">{perWeek(p.hours)}{included(p) ? x.tagIncluded : !balance.plan && withBackup && backupSold ? x.tagWith : ''}</small>
					</button>
				{/each}
			</div>
			{#if !balance.plan && pickedPlan}
				{@const chosen = planOf(pickedPlan, plans)}
				<div class="step" data-testid="plan-step">
					{#if chosen}<p class="hint">{$t.buy.step.for(`${x.planName(chosen.hours, chosen.hours >= 720)}, ${euro(planTotal(chosen))}`)}</p>{/if}
					<Waiver {withdrawal} bind:checked={k.waivedPlan} testid="plan-waiver" />
					<p class="row"><button class="small" onclick={payPlan} disabled={busy || planBlocked} data-testid="plan-pay">{$t.buy.step.pay}</button> <button class="link" onclick={dropPlan} disabled={busy} data-testid="plan-step-cancel">{$t.buy.step.cancel}</button></p>
				</div>
			{/if}
		{/if}

		<details class="more" bind:open={k.moreOpen}>
			<summary data-testid="package-more">{x.more}</summary>
			<div class="group">
				<p class="label">{x.topUp}</p>
				<TopUp {master} credits={balance.credits} {withdrawal} ready={termsRead} onbooked={read} onwaiver={readWithdrawal} />
			</div>
			{#if balance.plan && appPays}
				<div class="group">
					<p class="label">{x.moreHours}</p>
					<p class="row">{#each [5, 10, 30] as h (h)}<button class="chip" onclick={() => buyHours(h)} disabled={busy || purchaseLocked(buying)} data-testid={`buy-${h}`}>{buying.phase === 'quoting' && buying.hours === h ? x.quoting : x.plusHours(h)}</button>{/each}</p>
					<HourQuote quote={buying.phase === 'open' ? buying.quote : null} short={buying.phase === 'short'} hoursAsked={buying.hours} topUpHint={x.topUpHint} confirmLabel={x.buy} disabled={busy || buying.phase === 'buying'} onconfirm={() => purchase.confirm()} oncancel={() => purchase.cancel()} />
					{#if buying.error}<p class="warn" role="alert" data-testid="buy-error">{buying.error}</p>{/if}
				</div>
			{/if}
			{#if balance.plan && !byVoucher}
				<p class="row">
					{#if byStripe}
						<button class="link" onclick={portal} disabled={busy} data-testid="plan-portal">{x.manage}</button>
					{:else}
						<button class="link" onclick={() => (k.choosing = !choosing)} data-testid="plan-change">{choosing ? x.changeBack : x.change}</button>
						<button class="link" onclick={() => plan(null)} disabled={busy} data-testid="plan-end">{x.end}</button>
					{/if}
				</p>
			{/if}
		</details>
		<!-- Always there and outside the fold, so the invoices are found: the list,
		     or why it is empty; the subscription's own invoices are at Stripe. -->
		<details class="purchases" data-testid="purchases">
			<summary>{x.purchases(purchases?.length ?? 0)}</summary>
			{#if purchasesError}<p class="warn">{x.purchasesError(purchasesError)}</p>
			{:else if purchases === null}<p class="hint">…</p>
			{:else if !purchases.length}<p class="hint">{x.noPurchases}</p>
			{:else}
				<ul>
					{#each purchases as p (p.id)}
						<li data-testid="purchase">{p.at ? format.date(p.at, undefined, $lang) : '–'} · {euro(p.cents)}
							{#if p.invoiceUrl}· <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">{x.invoice}</a>{:else}<small class="hint">{x.invoiceLater}</small>{/if}</li>
					{/each}
				</ul>
			{/if}
			{#if byStripe}<p><button class="link" onclick={portal} disabled={busy} data-testid="purchases-portal">{x.subscriptionInvoices}</button></p>{/if}
		</details>
		{#if note}<p class="hint" role="status" data-testid="plan-note">{note}</p>{/if}
		{#if justBought && after}<p class="hint" data-testid="buy-after">{after}</p>{/if}
		{#if error}<p class="warn" role="alert" data-testid="plan-error">{error}</p>{/if}
	{/if}
{/snippet}

<section class="card package" data-testid="package">
	{#if balance && selfPays}
		<details class="self" bind:open={k.selfOpen} data-testid="package-self">
			<summary><strong>{x.selfPays}</strong> <span class="hint">{x.selfSee}</span></summary>
			<p class="hint">{x.selfHint(pays === 'app' ? 'app' : 'wallet')}</p>
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
<StripeCheckout bind:this={k.checkout} label={x.checkoutLabel} summary={ordering} />

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
	.plan-choice.picked { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
	.step { margin: 0.75rem 0 0; padding: 0.6rem 0.9rem; border-left: 3px solid var(--accent); }
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
	.voucher { margin: 0.5rem 0 0.75rem; }
	.voucher summary { cursor: pointer; color: var(--text-2); }
	.voucher input { width: 14rem; font-family: var(--mono); text-transform: uppercase; }
	.with-backup { display: flex; gap: 0.5rem; align-items: flex-start; margin: 0.5rem 0; }
	.with-backup input { width: auto; margin-top: 0.25rem; flex: none; }
	.badge { font-style: normal; font-size: 0.75rem; font-weight: 600; padding: 0.05rem 0.5rem; border-radius: 999px; background: var(--accent); color: var(--cta-text, #0f1b2d); }
	.purchases summary { color: var(--text-2); }
	.purchases ul { list-style: none; padding: 0; margin: 0.3rem 0; }
</style>
