<script>
	// The withdrawal function (§ 356a BGB, "Vertrag widerrufen"): what can be
	// withdrawn and until when, one button that withdraws, then when the
	// declaration was received and a file to keep. Shown only while the service
	// lists something as withdrawable.
	import { IMPRINT_URL, PROVIDER, creditsAccount, germanDate, germanDateTime, withdraw, withdrawableName, withdrawalRecord } from '$lib/credits.js';

	/** @type {{ master: Uint8Array, withdrawable: { subject: 'subscription' | 'credits' | 'backup', what: string, concludedAt: string | null, until: string | null }[], ondone?: () => Promise<void> | void, onclose?: () => void }} */
	let { master, withdrawable, ondone = () => {}, onclose = () => {} } = $props();

	const address = $derived(creditsAccount(master).address);
	// The list this view was opened with: it stays when the balance changes.
	const listed = withdrawable;

	let busy = $state(false);
	let error = $state('');
	/** @type {Awaited<ReturnType<typeof withdraw>> | null} */
	let done = $state(null);

	async function now() {
		busy = true;
		error = '';
		try {
			done = await withdraw(master);
			await ondone();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	function save() {
		if (!done) return;
		const { filename, text } = withdrawalRecord({ withdrawn: done.withdrawn.length ? done.withdrawn : listed, receivedAt: done.receivedAt, refundId: done.refund?.id || null, address });
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

<div class="withdraw" role="region" aria-label="Vertrag widerrufen" data-testid="withdraw-view">
	<p class="title">Vertrag widerrufen</p>
	<ul data-testid="withdraw-list">
		{#each listed as w}
			<li><strong>{withdrawableName(w)}</strong>{#if w.concludedAt}, geschlossen am {germanDate(w.concludedAt)}{/if}{#if w.until}, Widerruf möglich bis {germanDateTime(w.until)}{/if}</li>
		{/each}
	</ul>
	<dl>
		<dt>Konto</dt><dd class="mono">{address}</dd>
		<dt>Anbieter</dt><dd>{PROVIDER} · <a href={IMPRINT_URL} target="_blank" rel="noopener noreferrer">Impressum</a></dd>
	</dl>
	{#if done}
		<p class="ok" role="status" data-testid="withdraw-done">Widerruf eingegangen am {germanDateTime(done.receivedAt)}.</p>
		<p class="hint" data-testid="withdraw-next">Das Paket ist damit beendet. Das Geld kommt innerhalb von 14 Tagen zurück, beim Abo anteilig für die schon genutzte Zeit.{#if done.refund?.id} Erstattung: <span class="mono">{done.refund.id}</span>.{/if}</p>
		<p class="row">
			<button type="button" class="primary" onclick={save} data-testid="withdraw-save">Bestätigung speichern</button>
			<button type="button" class="link" onclick={onclose}>Schließen</button>
		</p>
	{:else}
		<p class="hint" data-testid="withdraw-what">Mit dem Widerruf endet das Paket sofort, und nicht verbrauchtes Guthaben wird zur Erstattung angemeldet. Das Geld kommt innerhalb von 14 Tagen zurück, beim Abo anteilig für die schon genutzte Zeit.</p>
		<p class="row">
			<button type="button" class="primary" onclick={now} disabled={busy} data-testid="withdraw-now">Jetzt widerrufen</button>
			<button type="button" class="link" onclick={onclose} disabled={busy}>Abbrechen</button>
		</p>
	{/if}
	{#if error}<p class="warn" role="alert" data-testid="withdraw-error">{error}</p>{/if}
</div>

<style>
	.withdraw { margin: 0.75rem 0 0; padding: 0.9rem 1rem; border-radius: var(--radius-sm); background: var(--surface-2); border-left: 4px solid var(--accent); }
	.withdraw p { margin: 0.4rem 0; }
	.title { font-weight: 600; }
	ul { margin: 0.4rem 0; padding-left: 1.1rem; font-size: 0.95rem; }
	dl { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.75rem; margin: 0.5rem 0; font-size: 0.9rem; }
	dt { color: var(--text-2); }
	dd { margin: 0; overflow-wrap: anywhere; }
	.mono { font-family: 'IBM Plex Mono', monospace; font-size: 0.8rem; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.9rem; }
	.primary { padding: 0.5rem 1.1rem; font-weight: 600; }
	.link { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; font-size: 0.9rem; }
	.hint { color: var(--text-2); }
	.ok { font-weight: 600; }
	.warn { color: var(--warn); }
</style>
