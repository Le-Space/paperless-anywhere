<script>
	// The backup in the package card (Le-Space/paperless-anywhere#175): how long
	// it is paid, what the service's notice says, and the two ways to pay it
	// beside the months from the balance: as a line of the subscription, and a
	// year of keeping at once. Each is a purchase of its own with its own
	// declaration on withdrawal. The app shows what the service says and
	// derives no dates itself.
	import { addBackupLine, backupStatus, startBackupYear, waitForBackup, waiverOf, WaiverError } from '$lib/credits.js';
	import StripeCheckout from '$lib/StripeCheckout.svelte';
	import Waiver from '$lib/Waiver.svelte';
	import { format, lang, t, tr } from '$lib/i18n/index.js';

	/**
	 * @type {{
	 *   master: Uint8Array,
	 *   backup: NonNullable<ReturnType<typeof import('$lib/credits.js').backupOf>>,
	 *   own?: boolean,
	 *   included?: boolean,
	 *   offer: ReturnType<typeof import('$lib/credits.js').backupOfferOf>,
	 *   plan: { billing: 'stripe' | 'credits', renewsAt: string | null, periodEnd: string | null, cancelAtPeriodEnd: boolean } | null,
	 *   withdrawal: { version: string, de: string, en: string } | null,
	 *   termsRead: boolean,
	 *   disabled?: boolean,
	 *   onchanged?: () => unknown,
	 *   onportal?: () => unknown,
	 *   onwaiver?: () => unknown
	 * }}
	 */
	let { master, backup, own = false, included = false, offer, plan, withdrawal, termsRead, disabled = false, onchanged = () => {}, onportal = () => {}, onwaiver = () => {} } = $props();

	const euro = (/** @type {number} */ cents) => format.euro(cents, $lang);
	const x = $derived($t.buy.line);
	const date = (/** @type {string | null} */ iso) => (iso ? format.date(iso, undefined, $lang) : '–');
	// Paid from the person's own wallet (setup): Le Space's backup period says
	// nothing about their backups, and nothing is offered for them here.
	const status = $derived(own ? { tone: /** @type {const} */ ('ok'), text: x.own } : ($lang, backupStatus(backup)));
	const sold = $derived(Boolean(offer?.planOffered) && !own);
	// The line can be added to a running card subscription that is not ending.
	// Not for a package whose price includes the backup: there is nothing to add.
	const canAdd = $derived(sold && !included && plan?.billing === 'stripe' && !plan.cancelAtPeriodEnd && !backup.renewsWithPlan);
	const nextCharge = $derived(plan ? date(plan.renewsAt ?? plan.periodEnd) : '');

	let busy = $state(false);
	let note = $state('');
	let error = $state('');
	// Unticked for every purchase: each box is the declaration for that one.
	// The folds stay as the person left them; a re-read of the balance closes nothing.
	let addOpen = $state(false);
	let yearOpen = $state(false);
	let waivedAdd = $state(false);
	let waivedYear = $state(false);
	const blocked = (/** @type {boolean} */ ticked) => !termsRead || (Boolean(withdrawal) && !ticked);
	/** @type {StripeCheckout | undefined} */
	let checkout = $state();

	async function act(/** @type {() => Promise<string>} */ fn) {
		busy = true;
		note = error = '';
		try {
			note = await fn();
			await onchanged();
		} catch (e) {
			if (e instanceof WaiverError) onwaiver();
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
	const add = () =>
		act(async () => {
			const waiver = waiverOf(withdrawal, waivedAdd);
			waivedAdd = false;
			await addBackupLine(master, waiver);
			return tr().buy.line.added;
		});
	const year = () =>
		act(async () => {
			const before = backup.fundedUntil;
			const waiver = waiverOf(withdrawal, waivedYear);
			waivedYear = false;
			const secret = await startBackupYear(master, waiver);
			const outcome = await checkout?.pay(secret);
			if (outcome === 'closed') return tr().buy.line.yearNotBought;
			if (outcome === 'failed') throw new Error(tr().buy.line.payPageFailed);
			note = tr().buy.line.yearBooking;
			const { booked, balance } = await waitForBackup(master, before);
			return booked ? tr().buy.line.yearBooked(date(balance?.backup?.fundedUntil ?? null)) : tr().buy.line.yearSoon;
		});
</script>

<div class="backup" data-testid="backup-line">
	<p class={status.tone} role={status.tone === 'warn' || status.tone === 'over' ? 'alert' : undefined} data-testid="backup-status" data-tone={status.tone}>{status.text}</p>
	{#if !own && backup.retentionUntil && backup.active && !backup.renewsWithPlan && status.tone === 'ok'}
		<p class="hint">{x.retention(date(backup.retentionUntil))}</p>
	{/if}

	{#if sold && offer}
		{#if canAdd}
			<details class="buy" data-testid="backup-add-fold" bind:open={addOpen}>
				<summary data-testid="backup-add-summary">{x.addFold(euro(offer.monthCents))}</summary>
				<p class="hint">{x.addHint(nextCharge, offer.retentionDays)}</p>
				<Waiver {withdrawal} bind:checked={waivedAdd} testid="backup-add-waiver" />
				<p class="row"><button class="small" onclick={add} disabled={disabled || busy || blocked(waivedAdd)} data-testid="backup-add">{x.addButton(euro(offer.monthCents))}</button></p>
			</details>
		{:else if backup.renewsWithPlan}
			<p class="hint">{x.remove.before}<button class="link" onclick={() => onportal()} disabled={disabled || busy} data-testid="backup-remove">{x.remove.link}</button>{x.remove.after(offer.retentionDays)}</p>
		{/if}

		<details class="buy" data-testid="backup-year-fold" bind:open={yearOpen}>
			<summary data-testid="backup-year-summary">{x.yearFold(euro(offer.yearCents))}</summary>
			<p><strong>{x.keepStrong}</strong> {x.keep}</p>
			<p class="hint">{x.yearHint(offer.yearDays)}</p>
			<Waiver {withdrawal} bind:checked={waivedYear} testid="backup-year-waiver" />
			<p class="row"><button class="small" onclick={year} disabled={disabled || busy || blocked(waivedYear)} data-testid="backup-year">{x.yearButton(euro(offer.yearCents))}</button></p>
		</details>
		{#if status.tone === 'soon' || status.tone === 'warn'}
			<p class="hint" data-testid="backup-mail-note">{x.mailNote}</p>
		{/if}
	{/if}
	{#if note}<p class="hint" role="status" data-testid="backup-note">{note}</p>{/if}
	{#if error}<p class="warn" role="alert" data-testid="backup-error">{error}</p>{/if}
</div>
<StripeCheckout bind:this={checkout} label={x.yearCheckout} summary={offer ? x.yearSummary(euro(offer.yearCents)) : ''} />

<style>
	.backup { margin: 1rem 0 0; padding: 0.9rem 0 0; border-top: 1px solid var(--line); }
	.backup p { margin: 0 0 0.5rem; }
	.hint { color: var(--text-2); font-size: 0.9rem; }
	.soon { color: var(--text-2); }
	.warn, .over { padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); background: var(--warn-bg); color: var(--warn); }
	p.warn[data-testid='backup-error'] { padding: 0; background: none; }
	.buy { margin: 0.5rem 0; font-size: 0.95rem; }
	.buy summary { cursor: pointer; color: var(--text-2); }
	.buy p { margin: 0.5rem 0; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.75rem; }
	.link { background: none; border: none; color: inherit; text-decoration: underline; padding: 0; font: inherit; }
</style>
