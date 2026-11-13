<script>
	// Stripe's embedded Checkout on the credits service's /pay page, framed:
	// Stripe.js never runs in this app's origin, which holds the unlocked vault.
	// `pay(clientSecret)` resolves 'paid', 'failed' or 'closed'.
	import { CREDITS_URL, payMessage, payUrl } from '$lib/credits.js';
	import { t } from '$lib/i18n/index.js';

	/** @type {{ label?: string, summary?: string }} `summary`: what is ordered, in one line above the Checkout */
	let { label = '', summary = '' } = $props();
	const title = $derived(label || $t.pkg.payWithStripe);
	/** @type {HTMLDialogElement | undefined} */
	let dialog = $state();
	/** @type {string | null} */
	let frame = $state(null);
	/** @type {((outcome: 'paid' | 'failed' | 'closed') => void) | null} */
	let settle = null;

	/** @param {string} clientSecret @returns {Promise<'paid' | 'failed' | 'closed'>} */
	export function pay(clientSecret) {
		frame = payUrl(CREDITS_URL, { clientSecret, origin: location.origin });
		dialog?.showModal();
		return new Promise((resolve) => (settle = resolve));
	}
	function done(/** @type {'paid' | 'failed' | 'closed'} */ outcome) {
		dialog?.close();
		frame = null;
		settle?.(outcome);
		settle = null;
	}
	$effect(() => {
		/** @param {MessageEvent} event */
		const listen = (event) => {
			const what = payMessage(event, CREDITS_URL);
			if (what === 'paid') done('paid');
			else if (what === 'failed') done('failed');
		};
		window.addEventListener('message', listen);
		return () => window.removeEventListener('message', listen);
	});
</script>

<dialog bind:this={dialog} onclose={() => settle && done('closed')} aria-label={title}>
	<button class="quiet close" onclick={() => done('closed')} aria-label={$t.pkg.close}>✕</button>
	{#if summary && frame}<p class="summary" data-testid="checkout-summary">{summary}</p>{/if}
	{#if frame}<iframe src={frame} title={title} allow="payment"></iframe>{/if}
</dialog>

<style>
	dialog { width: min(36rem, 96vw); height: min(44rem, 90vh); padding: 0; border: none; border-radius: 6px; }
	dialog[open] { display: flex; flex-direction: column; }
	.summary { margin: 0; padding: 0.7rem 2.6rem 0.7rem 1rem; font-size: 0.9rem; border-bottom: 1px solid var(--line); flex: none; }
	dialog::backdrop { background: rgb(0 0 0 / 0.4); }
	iframe { width: 100%; flex: 1; min-height: 0; border: 0; }
	.close { position: absolute; top: 0.3rem; right: 0.4rem; }
</style>
