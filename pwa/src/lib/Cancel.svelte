<script>
	// The app's own cancel page (§ 312k BGB, "Verträge hier kündigen"): which
	// contract, which kind of cancellation and when it takes effect, one button
	// that cancels, then when it was received and a file to keep. Stripe's
	// portal stays for payment details and invoices; an older service without
	// the cancel route sends the person there to cancel.
	import { CANCEL_KIND, IMPRINT_URL, PROVIDER, CancelUnsupportedError, cancelSubscription, cancellationRecord, contractName, creditsAccount, germanDate, germanDateTime } from '$lib/credits.js';

	/** @type {{ master: Uint8Array, plan: { id: string, renewsAt: string | null, periodEnd: string | null, cancelAtPeriodEnd: boolean }, current: { hours: number } | null, onportal: () => Promise<void> | void, ondone?: () => Promise<void> | void, onclose?: () => void }} */
	let { master, plan, current, onportal, ondone = () => {}, onclose = () => {} } = $props();

	const contract = $derived(contractName(current, plan.id));
	const endsAt = $derived(plan.renewsAt ?? plan.periodEnd);
	const address = $derived(creditsAccount(master).address);

	let busy = $state(false);
	let error = $state('');
	let note = $state('');
	/** @type {{ receivedAt: string, effectiveAt: string | null } | null} */
	let done = $state(null);

	async function cancel() {
		busy = true;
		error = note = '';
		try {
			const r = await cancelSubscription(master);
			done = { receivedAt: r.receivedAt, effectiveAt: r.effectiveAt ?? endsAt };
			await ondone();
		} catch (e) {
			if (e instanceof CancelUnsupportedError) {
				note = e.message;
				await onportal();
			} else error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	function save() {
		if (!done) return;
		const { filename, text } = cancellationRecord({ contract, receivedAt: done.receivedAt, effectiveAt: done.effectiveAt, address });
		const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

<div class="cancel" role="region" aria-label="Vertrag kündigen" data-testid="cancel-view">
	<p class="title">Vertrag kündigen</p>
	<dl>
		<dt>Vertrag</dt><dd data-testid="cancel-contract">{contract}</dd>
		<dt>Art</dt><dd data-testid="cancel-kind">{CANCEL_KIND}, also zum {germanDate(endsAt)}</dd>
		<dt>Konto</dt><dd class="mono">{address}</dd>
		<dt>Anbieter</dt><dd data-testid="cancel-provider">{PROVIDER} · <a href={IMPRINT_URL} target="_blank" rel="noopener noreferrer">Impressum</a></dd>
	</dl>
	{#if done}
		<p class="ok" role="status" data-testid="cancel-done">Kündigung eingegangen am {germanDateTime(done.receivedAt)}, wirksam zum {germanDate(done.effectiveAt)}.</p>
		<p class="row">
			<button type="button" class="primary" onclick={save} data-testid="cancel-save">Bestätigung speichern</button>
			<button type="button" class="link" onclick={onclose}>Schließen</button>
		</p>
	{:else}
		{#if plan.cancelAtPeriodEnd}<p class="hint">Dieses Abo ist schon gekündigt und endet am {germanDate(endsAt)}.</p>{/if}
		<p class="row">
			<button type="button" class="primary" onclick={cancel} disabled={busy} data-testid="cancel-now">Jetzt kündigen</button>
			<button type="button" class="link" onclick={onclose} disabled={busy}>Abbrechen</button>
		</p>
	{/if}
	{#if note}<p class="hint" role="status" data-testid="cancel-note">{note}</p>{/if}
	{#if error}<p class="warn" role="alert" data-testid="cancel-error">{error}</p>{/if}
	<p class="small"><button type="button" class="link" onclick={onportal} disabled={busy} data-testid="cancel-portal">Zahlungsdaten und Rechnungen</button></p>
	<p class="small hint">Fristlos aus wichtigem Grund: per E-Mail an <a href="mailto:info@le-space.de">info@le-space.de</a></p>
</div>

<style>
	.cancel { margin: 0.75rem 0 0; padding: 0.9rem 1rem; border-radius: var(--radius-sm); background: var(--surface-2); border-left: 4px solid var(--accent); }
	.cancel p { margin: 0.4rem 0; }
	.title { font-weight: 600; }
	dl { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.75rem; margin: 0.5rem 0; font-size: 0.9rem; }
	dt { color: var(--text-2); }
	dd { margin: 0; overflow-wrap: anywhere; }
	.mono { font-family: 'IBM Plex Mono', monospace; font-size: 0.8rem; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.9rem; }
	.primary { padding: 0.5rem 1.1rem; font-weight: 600; }
	.link { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; font-size: 0.9rem; }
	.small { font-size: 0.85rem; }
	.hint { color: var(--text-2); }
	.ok { font-weight: 600; }
	.warn { color: var(--warn); }
</style>
