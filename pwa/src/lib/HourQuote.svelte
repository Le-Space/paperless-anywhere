<script>
	// The confirmation before VM hours are bought from Le Space Credits: what
	// they cost, the balance and the hours before and after. Only its confirm
	// button buys.
	import { amount } from '$lib/balances.js';

	/** @type {{ quote: Awaited<ReturnType<typeof import('$lib/credits.js').quoteVm>> | null, hoursAsked?: number | null, short?: boolean, topUpHint: string, confirmLabel: string, disabled?: boolean, onconfirm: () => void, oncancel: () => void }} */
	let { quote, hoursAsked = null, short = false, topUpHint, confirmLabel, disabled = false, onconfirm, oncancel } = $props();

	const euro = (/** @type {number} */ credits) => `${amount(credits / 100)} €`;
	const credits = (/** @type {number} */ n) => `${n.toLocaleString('de-DE')} Credits`;
	const hours = (/** @type {number} */ n) => `${amount(n, 1)} h`;
	const until = $derived(quote?.expiration ? new Date(quote.expiration).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
</script>

{#if short}
	<div class="quote" role="alert" data-testid="hour-quote-short">
		<p class="title"><strong>Das Guthaben reicht nicht für {hoursAsked ?? ''} Stunden.</strong></p>
		<p class="hint">{topUpHint}</p>
		<div class="row"><button class="secondary" onclick={oncancel} {disabled} data-testid="quote-cancel">Schließen</button></div>
	</div>
{:else if quote}
	<div class="quote" role="group" aria-label="Kauf bestätigen" data-testid="hour-quote">
		<p class="title"><strong>{quote.hours} Stunden kaufen?</strong></p>
		<dl>
			<dt>Bezahlt aus</dt><dd>deinem Le-Space-Credits-Guthaben</dd>
			<dt>Kosten</dt><dd data-testid="quote-cost">{credits(quote.chargedCredits)} (≈ {euro(quote.chargedCredits)})</dd>
			{#if quote.creditsBefore != null && quote.creditsAfter != null}
				<dt>Guthaben</dt><dd data-testid="quote-balance">{euro(quote.creditsBefore)} → {euro(quote.creditsAfter)}</dd>
			{/if}
			{#if quote.hoursBefore != null && quote.hoursAfter != null}
				<dt>VM-Stunden</dt><dd data-testid="quote-hours">{hours(quote.hoursBefore)} → {hours(quote.hoursAfter)}{until ? `, nutzbar bis ${until}` : ''}</dd>
			{:else if until}
				<dt>Nutzbar bis</dt><dd>{until}</dd>
			{/if}
		</dl>
		<div class="row">
			<button onclick={onconfirm} {disabled} data-testid="quote-confirm">{confirmLabel}</button>
			<button class="secondary" onclick={oncancel} {disabled} data-testid="quote-cancel">Abbrechen</button>
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
