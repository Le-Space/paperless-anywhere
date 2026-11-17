<script>
	// The area "Paket" of the v0.2 interface, drawn from the same flow control
	// as v0.1's Package.svelte (package-card.svelte.js). The package is for both
	// views as it is: what is booked, what it costs, the balance, the invoices,
	// and the legal buttons, which stay in sight and keep their wording.
	//
	// What changes against v0.1: one thing per card instead of one long card
	// with folds; topping up is no longer inside a fold; a balance that cannot
	// be read has a retry and still leaves a way to cancel; leaving for Stripe
	// asks first, since it locks the app; ending or changing a package asks in
	// the shell's dialog. "Technisch" adds who pays the VM.
	import BackupLine from '$lib/BackupLine.svelte';
	import Cancel from '$lib/Cancel.svelte';
	import HourQuote from '$lib/HourQuote.svelte';
	import RefreshBalances from '$lib/RefreshBalances.svelte';
	import StripeCheckout from '$lib/StripeCheckout.svelte';
	import Terms from '$lib/Terms.svelte';
	import TopUp from '$lib/TopUp.svelte';
	import Waiver from '$lib/Waiver.svelte';
	import Withdraw from '$lib/Withdraw.svelte';
	import { cancelMailto, planHours, planOf } from '$lib/credits.js';
	import { format, lang, t } from '$lib/i18n/index.js';
	import { createPackageCard } from '$lib/package-card.svelte.js';
	import { purchaseLocked } from '$lib/purchase.js';

	/**
	 * @type {{
	 *   master: Uint8Array, technical: boolean, version?: number, acting?: boolean,
	 *   onglance?: (g: any) => void, onprofile?: () => void, onsetup?: () => void,
	 *   confirm: (q: { title: string, text: string, yes: string, no: string, danger?: boolean }) => Promise<boolean>
	 * }}
	 * acting: a start, a backup or a stop is under way (leaving then says so); onsetup: opens the setup in the technical view.
	 */
	let { master, technical, version = 0, acting = false, onglance = () => {}, onprofile = () => {}, onsetup = () => {}, confirm } = $props();

	const v = $derived($t.v2.plan);
	const k = createPackageCard({
		get master() { return master; },
		get version() { return version; },
		onglance: (/** @type {any} */ g) => onglance(g),
		onprofile: () => onprofile(),
		// Ending or changing a package, and paying from the balance instead: asked in the shell's dialog.
		confirm: (/** @type {string} */ question) => confirm({ title: $t.v2.confirmTitle, text: question, yes: $t.v2.confirmYes, no: $t.v2.confirmNo })
	});
	const x = $derived(k.x);
	const balance = $derived(k.balance);
	const pays = $derived(k.pays);
	// Stripe's portal is another site: the app locks when it is left, so it asks first.
	const portal = async () => {
		if (await confirm({ title: v.leaveTitle, text: acting ? `${v.leaveText} ${v.leaveBusy}` : v.leaveText, yes: v.leaveYes, no: v.leaveNo })) k.portal();
	};
</script>

{#snippet content()}
	{#if balance}
		<Terms {master} terms={balance.terms} onaccepted={k.read} />

		<div class="card" data-testid="v2-plan-state">
			{#if balance.plan}
				<!-- One answer first: how long Paperless can run. -->
				{#if pays === 'app' || pays === 'wallet'}
					<h2 class="big" data-testid="plan-left">{x.runsOver(pays)}</h2>
					<p class="hint" data-testid="plan-source">{x.notUsed(k.hoursLeft != null ? x.hours(k.hoursLeft) : null, pays)}</p>
					<!-- v0.1 named the setting without a way to it. -->
					<button class="sec" onclick={onsetup} data-testid="v2-plan-payer">{technical ? v.toSetup : v.payer}</button>
				{:else}
					<h2 class="big" data-testid="plan-left">
						{#if k.hoursLeft != null}{x.hours(k.hoursLeft)} <span class="rest">{x.left}{balance.plan.periodEnd ? x.until(k.day(balance.plan.periodEnd)) : ''}</span>{:else}{x.active}{/if}
					</h2>
				{/if}
				{#if pays !== 'app' && pays !== 'wallet' && k.hoursLeft != null && k.current && k.hoursLeft <= k.current.hours}
					<div class="meter" role="meter" aria-valuemin="0" aria-valuemax={k.current.hours} aria-valuenow={k.hoursLeft} aria-label={x.meter}><span style="width: {(k.share ?? 1) * 100}%"></span></div>
				{/if}
				{#if k.ending && k.endsAt != null}
					<div class="alert" role="alert" data-testid="plan-ending"><p><strong>{x.ending[k.ending](format.dateTime(k.endsAt, undefined, $lang))}</strong> {x.ending.what}</p></div>
				{/if}
				{#if k.low}
					<div class="alert" role="status" data-testid="plan-low">
						<p>{x.low(x.hours(k.hoursLeft ?? 0), k.appPays)}</p>
						{#if k.bigger}{@const bigger = k.bigger}<button class="sec" onclick={() => (k.byStripe ? portal() : k.plan(bigger.id))} disabled={k.busy} data-testid="plan-upgrade">{x.upgrade(bigger.hours, bigger.hours >= 720, k.euro(bigger.priceCredits))}</button>{/if}
					</div>
				{/if}
				<p class="hint" data-testid="plan-current">
					{#if k.byVoucher}<span data-testid="voucher-period">{x.voucher.period(k.longDay(balance.plan.periodEnd))}</span> {x.voucher.periodEnds}
					{:else if k.current && k.byStripe}{x.yourSubscription(planHours(k.current), k.euro(k.current.priceCredits))} {balance.plan.cancelAtPeriodEnd ? x.cancelledEnds(k.day(balance.plan.renewsAt ?? balance.plan.periodEnd)) : x.renewsInvoice(k.day(balance.plan.renewsAt ?? balance.plan.periodEnd))}{#if k.hoursLeft != null && k.hoursLeft > k.current.hours}{' '}{x.moreThanPackage}{/if}
					{:else if k.current}{x.yourPackage(planHours(k.current), k.euro(k.current.priceCredits))} {x.renewsFromBalance(k.day(balance.plan.periodEnd))} {x.endAnyMonth}{#if k.hoursLeft != null && k.hoursLeft > k.current.hours}{' '}{x.moreThanPackage}{/if}{:else}{x.packageId(balance.plan.id)}{/if}
				</p>
				{#if !k.byVoucher}
					<div class="row">
						{#if k.byStripe}
							<button class="small" onclick={portal} disabled={k.busy} data-testid="plan-portal">{x.manage}</button>
						{:else}
							<button class="small" aria-expanded={k.choosing} onclick={() => (k.choosing = !k.choosing)} data-testid="plan-change">{k.choosing ? x.changeBack : x.change}</button>
							<button class="small" onclick={() => k.plan(null)} disabled={k.busy} data-testid="plan-end">{x.end}</button>
						{/if}
					</div>
				{/if}
				{#if k.byStripe && !k.cancelling}
					<!-- The cancel button (§ 312k BGB): always in sight, no fold, no portal. -->
					<p class="row"><button class="small" onclick={() => balance?.plan && (k.cancelling = { plan: balance.plan, current: k.current })} disabled={k.busy} data-testid="plan-cancel">{x.legal.cancel}</button></p>
				{/if}
			{:else}
				<h2 class="big" data-testid="plan-none">{x.none}</h2>
				<p class="hint" data-testid="plan-none-hint">{x.noneHint}</p>
			{/if}

			{#if k.cancelling}
				<Cancel {master} plan={k.cancelling.plan} current={k.cancelling.current} onportal={portal} ondone={k.read} onclose={() => (k.cancelling = null)} />
			{/if}
			{#if k.withdrawable.length && !k.withdrawing}
				<!-- The withdrawal button (§ 356a BGB): in sight for as long as something can be withdrawn. -->
				<p class="row"><button class="small" onclick={() => (k.withdrawing = true)} disabled={k.busy} data-testid="withdraw-open">{x.legal.withdraw}</button></p>
			{/if}
			{#if k.withdrawing}
				<Withdraw {master} withdrawable={k.withdrawable} ondone={k.read} onclose={() => { k.withdrawing = false; k.read(); }} />
			{/if}
		</div>

		{#if !balance.plan || k.choosing}
			<div class="card" data-testid="v2-plan-choose">
				<h2>{balance.plan ? v.yourPlan : v.choose}</h2>
				{#if !balance.plan && k.voucherOffered}
					<!-- Before the plans: someone holding a code is not here to buy. -->
					<details class="voucher" data-testid="voucher">
						<summary>{x.voucher.fold}</summary>
						<p class="hint">{x.voucher.hint}</p>
						<form onsubmit={(e) => { e.preventDefault(); k.redeem(); }}>
							<label class="field" for="v2-voucher">{x.voucher.label}</label>
							<input id="v2-voucher" bind:value={k.voucherInput} placeholder={x.voucher.placeholder} autocomplete="off" autocapitalize="characters" spellcheck="false" data-testid="voucher-code" />
							<button class="sec" type="submit" disabled={k.busy || !k.voucherInput.trim()} data-testid="voucher-redeem">{x.voucher.button}</button>
						</form>
					</details>
				{/if}
				<p class="hint">{balance.plan ? x.chooseNew : x.chooseFirst}</p>
				{#if !balance.plan && k.allIncluded}
					<p class="hint" data-testid="plan-backup-included">{k.includedText}</p>
				{:else if !balance.plan && k.boxOffered && k.backupOffer}
					<label class="check" data-testid="plan-backup">
						<input type="checkbox" bind:checked={k.withBackup} data-testid="plan-backup-box" />
						<span><strong>{x.withBackup}</strong> {x.withBackupPrice(k.euro(k.backupOffer.monthCents))}{#if k.backupOffer.copies}{x.withBackupCopies(k.backupOffer.copies)}{/if}
							<br /><small class="hint">{x.withBackupHint}</small></span>
					</label>
				{/if}
				<div class="plans">
					{#each k.plans as p (p.id)}
						<button class="plan-choice" class:current={balance.plan?.id === p.id} class:picked={!balance.plan && k.pickedPlan === p.id} aria-pressed={balance.plan ? undefined : k.pickedPlan === p.id} onclick={() => (balance?.plan ? k.plan(p.id) : k.pickPlan(p.id))} disabled={k.busy || balance.plan?.id === p.id || (!balance.plan && !k.termsRead)} data-testid={`plan-${p.id}`}>
							{#if k.recommended === p.id}<em class="badge">{x.recommended}</em>{/if}
							<span>{x.planName(p.hours, p.hours >= 720)}</span><strong data-testid={`plan-price-${p.id}`}>{k.euro(balance.plan ? p.priceCredits : k.planTotal(p))}</strong><small class="hint">{k.perWeek(p.hours)}{k.included(p) ? x.tagIncluded : !balance.plan && k.withBackup && k.backupSold ? x.tagWith : ''}</small>
						</button>
					{/each}
				</div>
				{#if !balance.plan && k.pickedPlan}
					{@const chosen = planOf(k.pickedPlan, k.plans)}
					<div class="step" data-testid="plan-step">
						{#if chosen}<p>{$t.buy.step.for(`${x.planName(chosen.hours, chosen.hours >= 720)}, ${k.euro(k.planTotal(chosen))}`)}</p>{/if}
						<Waiver withdrawal={k.withdrawal} bind:checked={k.waivedPlan} testid="plan-waiver" />
						<button class="cta" onclick={k.payPlan} disabled={k.busy || k.planBlocked} data-testid="plan-pay">{$t.buy.step.pay}</button>
						<button class="lnk" onclick={k.dropPlan} disabled={k.busy} data-testid="plan-step-cancel">{$t.buy.step.cancel}</button>
					</div>
				{/if}
			</div>
		{/if}

		{#if balance.backup}
			<div class="card" data-testid="v2-plan-backup">
				<h2>{v.backup}</h2>
				<BackupLine {master} backup={k.voucherBackup ?? balance.backup} own={k.ownBackups} offer={k.backupOffer} plan={balance.plan} included={k.included(k.current)} withdrawal={k.withdrawal} termsRead={k.termsRead} disabled={k.busy} onchanged={k.read} onportal={portal} onwaiver={k.readWithdrawal} />
			</div>
		{/if}

		<div class="card" data-testid="v2-plan-money">
			<h2>{v.money}</h2>
			<p class="line"><strong class="amount" data-testid="balance-euro">{k.euro(balance.credits)}</strong>
				<span class="hint">{#if balance.reserved}{x.reserved(k.euro(balance.reserved))}{/if}{x.balanceUse}</span> <RefreshBalances testid="package-refresh" /></p>
			<!-- In v0.1 inside a fold; here in sight. -->
			<h3>{v.topUp}</h3>
			<TopUp {master} credits={balance.credits} withdrawal={k.withdrawal} ready={k.termsRead} onbooked={k.read} onwaiver={k.readWithdrawal} />
			{#if balance.plan && k.appPays}
				<h3>{v.moreHours}</h3>
				<p class="row">{#each [5, 10, 30] as h (h)}<button class="small" onclick={() => k.buyHours(h)} disabled={k.busy || purchaseLocked(k.buying)} data-testid={`buy-${h}`}>{k.buying.phase === 'quoting' && k.buying.hours === h ? x.quoting : x.plusHours(h)}</button>{/each}</p>
				<HourQuote quote={k.buying.phase === 'open' ? k.buying.quote : null} short={k.buying.phase === 'short'} hoursAsked={k.buying.hours} topUpHint={x.topUpHint} confirmLabel={x.buy} disabled={k.busy || k.buying.phase === 'buying'} onconfirm={() => k.purchase.confirm()} oncancel={() => k.purchase.cancel()} />
				{#if k.buying.error}<p class="error" role="alert" data-testid="buy-error">{k.buying.error}</p>{/if}
			{/if}
		</div>

		<!-- Always there, so the invoices are found: the list, or why it is empty. -->
		<details class="part" data-testid="purchases">
			<summary>{x.purchases(k.purchases?.length ?? 0)}</summary>
			{#if k.purchasesError}<p class="error">{x.purchasesError(k.purchasesError)}</p>
			{:else if k.purchases === null}<p class="hint">…</p>
			{:else if !k.purchases.length}<p class="hint">{x.noPurchases}</p>
			{:else}
				<ul>
					{#each k.purchases as p (p.id)}
						<li data-testid="purchase">{p.at ? format.date(p.at, undefined, $lang) : '–'} · {k.euro(p.cents)}
							{#if p.invoiceUrl}· <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">{x.invoice}</a>{:else}<small class="hint">{x.invoiceLater}</small>{/if}</li>
					{/each}
				</ul>
			{/if}
			{#if k.byStripe}<button class="lnk" onclick={portal} disabled={k.busy} data-testid="purchases-portal">{x.subscriptionInvoices}</button>{/if}
		</details>

		{#if technical}
			<div class="tech" data-testid="v2-tech-payer">
				<p class="tk">{$t.v2.view.technical} · {v.techPayer}</p>
				<p>{v.pays[/** @type {'lespace' | 'app' | 'wallet'} */ (pays) ?? 'none'] ?? v.pays.none}</p>
				<p class="hint">{v.techPayerHint}</p>
				<button class="small" onclick={onsetup} data-testid="v2-plan-to-setup">{v.toSetup}</button>
			</div>
		{/if}

		{#if k.note}<p class="ok" role="status" data-testid="plan-note">{k.note}</p>{/if}
		{#if k.justBought && k.after}<p class="hint" data-testid="buy-after">{k.after}</p>{/if}
		{#if k.error}<p class="error" role="alert" data-testid="plan-error">{k.error}</p>{/if}
	{/if}
{/snippet}

<div data-testid="package">
	{#if balance && k.selfPays}
		<details class="part" bind:open={k.selfOpen} data-testid="package-self">
			<summary><strong>{x.selfPays}</strong> <span class="hint">{x.selfSee}</span></summary>
			<p class="hint">{x.selfHint(pays === 'app' ? 'app' : 'wallet')}</p>
			{@render content()}
		</details>
	{:else if balance}
		{@render content()}
	{:else if k.balanceError}
		<!-- v0.1 showed the error alone; the legal way to cancel must stay reachable. -->
		<div class="card" data-testid="v2-plan-unreadable">
			<p class="error" role="alert">{k.balanceError}</p>
			<button class="sec" onclick={k.read} data-testid="v2-plan-again">{v.again}</button>
			<p class="hint"><a href={cancelMailto()} data-testid="v2-plan-cancel-by-mail">{$t.app.footer.cancel}</a> · {$t.app.footer.cancelHint}</p>
		</div>
	{:else}
		<p class="hint" role="status">…</p>
	{/if}
</div>
<StripeCheckout bind:this={k.checkout} label={x.checkoutLabel} summary={k.ordering} />

<style>
	h2 { font-size: 1.15rem; margin: 0 0 0.5rem; }
	h2.big { font-size: 1.6rem; font-weight: 700; margin: 0 0 0.4rem; }
	.big .rest { font-size: 1.05rem; font-weight: 400; color: var(--text-2); }
	h3 { margin: 1rem 0 0.4rem; }
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.1rem; margin: 0 0 0.9rem; box-shadow: var(--shadow); }
	.card p { margin: 0 0 0.6rem; }
	button { font: inherit; }
	.cta, .sec { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 3.25rem; padding: 0.6rem 1.1rem; margin: 0.6rem 0 0; font-size: 1.05rem; font-weight: 600; }
	.sec { background: transparent; color: var(--text); border-color: var(--text-2); }
	.small { background: transparent; color: var(--text); border-color: var(--line); padding: 0.4rem 0.9rem; min-height: 2.75rem; font-size: 0.95rem; }
	.lnk { background: none; border: 0; border-radius: 0; color: var(--accent-2-text); text-decoration: underline; text-underline-offset: 3px; padding: 0.6rem 0; min-height: 2.75rem; text-align: left; display: block; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0.6rem 0 0; }
	.hint { color: var(--text-2); font-size: 0.95rem; }
	.line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem; }
	.amount { font-size: 1.4rem; }
	.meter { height: 0.6rem; border-radius: 999px; background: var(--surface-2); overflow: hidden; margin: 0.5rem 0; }
	.meter span { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
	.alert { background: var(--warn-bg); color: var(--warn); border: 1px solid currentColor; border-radius: var(--radius-sm); padding: 0.8rem 0.9rem; margin: 0.6rem 0; }
	.alert .sec { color: inherit; border-color: currentColor; }
	.error { color: var(--danger); background: var(--danger-bg); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); }
	.ok { color: var(--ok); background: var(--ok-bg); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); margin: 0 0 0.9rem; }
	.check { display: flex; gap: 0.6rem; align-items: flex-start; margin: 0.6rem 0; }
	.check input { width: 1.4rem; height: 1.4rem; flex: none; margin-top: 0.2rem; }
	.field { display: block; margin: 0.6rem 0 0.3rem; color: var(--text-2); font-size: 0.95rem; }
	input:not([type='checkbox']) { width: 100%; min-height: 2.75rem; font-size: 1.05rem; }
	.voucher summary, .part summary { min-height: 2.75rem; font-weight: 600; }
	.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.6rem; margin: 0.6rem 0; }
	.plan-choice { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; text-align: left; min-height: 5.5rem; padding: 0.8rem; background: var(--surface); color: var(--text); border: 1px solid var(--text-2); border-radius: var(--radius-sm); position: relative; }
	.plan-choice strong { font-size: 1.2rem; }
	.plan-choice.picked, .plan-choice.current { border-width: 2px; border-color: var(--text); background: var(--surface-2); }
	.badge { font-style: normal; font-size: 0.75rem; background: var(--accent); color: var(--accent-ink); padding: 0.05rem 0.5rem; border-radius: 999px; }
	.step { background: var(--surface-2); border-radius: var(--radius-sm); padding: 0.8rem 0.9rem; margin: 0.6rem 0 0; }
	.part { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 0.8rem 1rem; margin: 0 0 0.9rem; }
	.part ul { padding-left: 1.2rem; }
	.tech { background: var(--surface-2); border: 1px dashed var(--text-2); border-radius: var(--radius-sm); padding: 0.75rem; margin: 0 0 0.9rem; font-size: 0.9rem; }
	.tech p { margin: 0 0 0.4rem; }
	.tk { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-2); }
</style>
