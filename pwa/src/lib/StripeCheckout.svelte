<script>
	// Stripe's embedded Checkout on the credits service's /pay page, framed:
	// Stripe.js never runs in this app's origin, which holds the unlocked vault.
	// `pay(clientSecret)` resolves 'paid', 'failed' or 'closed'.
	import { CREDITS_URL, payMessage, payUrl } from '$lib/credits.js';

	/** @type {{ label?: string }} */
	let { label = 'Bezahlen mit Stripe' } = $props();
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

<dialog bind:this={dialog} onclose={() => settle && done('closed')} aria-label={label}>
	<button class="quiet close" onclick={() => done('closed')} aria-label="Schließen">✕</button>
	{#if frame}<iframe src={frame} title={label} allow="payment"></iframe>{/if}
</dialog>

<style>
	dialog { width: min(36rem, 96vw); height: min(44rem, 90vh); padding: 0; border: none; border-radius: 6px; }
	dialog::backdrop { background: rgb(0 0 0 / 0.4); }
	iframe { width: 100%; height: 100%; border: 0; }
	.close { position: absolute; top: 0.3rem; right: 0.4rem; }
</style>
