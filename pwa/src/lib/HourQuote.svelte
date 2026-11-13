<script>
	// The confirmation before VM hours are bought from Le Space Credits: what
	// they cost, the balance and the hours before and after. Only its confirm
	// button buys.
	import { format, lang, t } from '$lib/i18n/index.js';

	/** @type {{ quote: Awaited<ReturnType<typeof import('$lib/credits.js').quoteVm>> | null, hoursAsked?: number | null, short?: boolean, topUpHint: string, confirmLabel: string, disabled?: boolean, onconfirm: () => void, oncancel: () => void }} */
	let { quote, hoursAsked = null, short = false, topUpHint, confirmLabel, disabled = false, onconfirm, oncancel } = $props();

	const q = $derived($t.buy.quote);
	const euro = (/** @type {number} */ credits) => format.euro(credits, $lang);
	const credits = (/** @type {number} */ n) => q.credits(format.number(n, undefined, $lang));
	const hours = (/** @type {number} */ n) => `${format.number(n, { maximumFractionDigits: 1 }, $lang)} h`;
	const until = $derived(quote?.expiration ? format.date(quote.expiration, undefined, $lang) : '');
</script>

{#if short}
	<div class="quote" role="alert" data-testid="hour-quote-short">
		<p class="title"><strong>{q.short(hoursAsked ?? '')}</strong></p>
		<p class="hint">{topUpHint}</p>
		<div class="row"><button class="secondary" onclick={oncancel} {disabled} data-testid="quote-cancel">{q.close}</button></div>
	</div>
{:else if quote}
	<div class="quote" role="group" aria-label={q.label} data-testid="hour-quote">
		<p class="title"><strong>{q.title(quote.hours)}</strong></p>
		<dl>
			<dt>{q.paidFrom}</dt><dd>{q.fromBalance}</dd>
			<dt>{q.cost}</dt><dd data-testid="quote-cost">{credits(quote.chargedCredits)} (≈ {euro(quote.chargedCredits)})</dd>
			{#if quote.creditsBefore != null && quote.creditsAfter != null}
				<dt>{q.balance}</dt><dd data-testid="quote-balance">{euro(quote.creditsBefore)} → {euro(quote.creditsAfter)}</dd>
			{/if}
			{#if quote.hoursBefore != null && quote.hoursAfter != null}
				<dt>{q.vmHours}</dt><dd data-testid="quote-hours">{hours(quote.hoursBefore)} → {hours(quote.hoursAfter)}{until ? q.usableUntil(until) : ''}</dd>
			{:else if until}
				<dt>{q.usableUntilLabel}</dt><dd>{until}</dd>
			{/if}
		</dl>
		<div class="row">
			<button onclick={onconfirm} {disabled} data-testid="quote-confirm">{confirmLabel}</button>
			<button class="secondary" onclick={oncancel} {disabled} data-testid="quote-cancel">{q.cancel}</button>
		</div>
	</div>
{/if}

<style>
	.quote { margin: 0.5rem 0; padding: 0.8rem 1rem; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--surface-2); }
	.title { margin: 0 0 0.5rem; }
	dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 0.75rem; margin: 0 0 0.75rem; }
	dt, .hint { color: var(--text-2); }
	.hint { margin: 0 0 0.75rem; }
	dd { margin: 0; }
	.secondary { background: transparent; color: var(--text); border-color: var(--line); }
	.row { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; }
</style>
