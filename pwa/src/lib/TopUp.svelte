<script>
	// Top up Le Space Credits by card. The payment form is Stripe's embedded
	// Checkout on the credits service's /pay page, framed here: Stripe.js never
	// runs in this app's origin, which holds the unlocked vault.
	import { CREDITS_URL, PACKAGES, WaiverError, payMessage, payUrl, startCheckout, waitForTopUp, waiverOf } from '$lib/credits.js';
	import Waiver from '$lib/Waiver.svelte';
	import { preparing } from '$lib/purchase-step.js';
	import { format, t, tr } from '$lib/i18n/index.js';

	// `withdrawal`: the declaration before a payment, null from an older
	// service; `ready` once the service's terms were read (or failed to be).
	/** @type {{ master: Uint8Array, credits: number, withdrawal?: { version: string, de: string, en: string } | null, ready?: boolean, onbooked?: () => void, onwaiver?: () => void }} */
	let { master, credits, withdrawal = null, ready = true, onbooked = () => {}, onwaiver = () => {} } = $props();
	// Unticked for every payment: it is the declaration for this one.
	let waived = $state(false);
	const blocked = $derived(!ready || (Boolean(withdrawal) && !waived));
	// The amount chosen first; its declaration shows below it, then the payment.
	let picked = $state('');
	const pick = (/** @type {string} */ id) => ((picked = id), (waived = false), preparing.set('topup'));
	const drop = () => ((picked = ''), (waived = false), preparing.set(''));
	$effect(() => {
		if ($preparing !== 'topup') (picked = ''), (waived = false);
	});
	const chosen = $derived(PACKAGES.find((p) => p.id === picked) ?? null);

	/** @type {string | null} */
	let frame = $state(null);
	let status = $state('');
	let busy = $state(false);
	/** @type {HTMLDialogElement | undefined} */
	let dialog = $state();

	async function buy(/** @type {string} */ packageId) {
		busy = true;
		status = tr().buy.topup.preparing;
		try {
			const clientSecret = await startCheckout(master, packageId, waiverOf(withdrawal, waived));
			drop();
			frame = payUrl(CREDITS_URL, { clientSecret, origin: location.origin });
			status = '';
			dialog?.showModal();
		} catch (e) {
			status = /** @type {Error} */ (e).message;
			if (e instanceof WaiverError) ((waived = false), onwaiver());
		} finally {
			busy = false;
		}
	}

	function close() {
		dialog?.close();
		frame = null;
	}

	async function paid() {
		close();
		status = tr().buy.topup.booking;
		const { booked, balance } = await waitForTopUp(master, credits);
		status = booked ? tr().buy.topup.booked(format.euro(balance?.credits ?? 0)) : tr().buy.topup.notBooked;
		onbooked();
	}

	$effect(() => {
		/** @param {MessageEvent} event */
		const listen = (event) => {
			const what = payMessage(event, CREDITS_URL);
			if (what === 'paid') paid();
			else if (what === 'failed') {
				close();
				status = tr().buy.topup.payPageFailed;
			}
		};
		window.addEventListener('message', listen);
		return () => window.removeEventListener('message', listen);
	});
</script>

<div class="topup" data-testid="topup">
	{#each PACKAGES as p (p.id)}
		<button class="small" class:picked={picked === p.id} aria-pressed={picked === p.id} onclick={() => pick(p.id)} disabled={busy || !ready} data-testid={`topup-${p.id}`}>{$t.buy.topup.button(p.credits / 100)}</button>
	{/each}
	{#if chosen}
		<div class="step" data-testid="topup-step">
			<p class="hint">{$t.buy.step.for($t.buy.topup.button(chosen.credits / 100))}</p>
			<Waiver {withdrawal} bind:checked={waived} testid="topup-waiver" />
			<p class="row"><button class="small" onclick={() => buy(chosen.id)} disabled={busy || blocked} data-testid="topup-pay">{$t.buy.step.pay}</button> <button class="link" onclick={drop} disabled={busy} data-testid="topup-step-cancel">{$t.buy.step.cancel}</button></p>
		</div>
	{/if}
	{#if status}<p class="hint" data-testid="topup-status">{status}</p>{/if}
</div>

<dialog bind:this={dialog} onclose={() => (frame = null)} aria-label={$t.buy.topup.dialog}>
	<button class="quiet close" onclick={close} aria-label={$t.buy.topup.close}>✕</button>
	{#if frame}<iframe src={frame} title={$t.buy.topup.frame} allow="payment"></iframe>{/if}
</dialog>

<style>
	.topup { margin-top: 0.4rem; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
	.topup p { flex-basis: 100%; margin: 0.2rem 0 0; }
	.picked { outline: 2px solid var(--accent); outline-offset: 1px; }
	.step { flex-basis: 100%; margin: 0.4rem 0 0; padding: 0.4rem 0.9rem; border-left: 3px solid var(--accent); }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.75rem; }
	.link { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; font-size: 0.9rem; }
	dialog { width: min(36rem, 96vw); height: min(44rem, 90vh); padding: 0; border: none; border-radius: 6px; }
	dialog::backdrop { background: rgb(0 0 0 / 0.4); }
	iframe { width: 100%; height: 100%; border: 0; }
	.close { position: absolute; top: 0.3rem; right: 0.4rem; }
</style>
