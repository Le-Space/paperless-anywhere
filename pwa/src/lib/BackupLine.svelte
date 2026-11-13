<script>
	// The backup in the package card (Le-Space/paperless-anywhere#175): how long
	// it is paid, what the service's notice says, and the two ways to pay it
	// beside the months from the balance: as a line of the subscription, and a
	// year of keeping at once. Each is a purchase of its own with its own
	// declaration on withdrawal. The app shows what the service says and
	// derives no dates itself.
	import { addBackupLine, backupStatus, germanDate, startBackupYear, waitForBackup, waiverOf, WaiverError } from '$lib/credits.js';
	import StripeCheckout from '$lib/StripeCheckout.svelte';
	import Waiver from '$lib/Waiver.svelte';

	/**
	 * @type {{
	 *   master: Uint8Array,
	 *   backup: NonNullable<ReturnType<typeof import('$lib/credits.js').backupOf>>,
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
	let { master, backup, offer, plan, withdrawal, termsRead, disabled = false, onchanged = () => {}, onportal = () => {}, onwaiver = () => {} } = $props();

	const euro = (/** @type {number} */ cents) => `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
	const status = $derived(backupStatus(backup));
	const sold = $derived(Boolean(offer?.planOffered));
	// The line can be added to a running card subscription that is not ending.
	const canAdd = $derived(sold && plan?.billing === 'stripe' && !plan.cancelAtPeriodEnd && !backup.renewsWithPlan);
	const nextCharge = $derived(plan ? germanDate(plan.renewsAt ?? plan.periodEnd) : '');

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
			return 'Die Sicherung ist jetzt Teil deines Abos. Die Rechnung über den Rest des Monats kommt von Stripe per E-Mail.';
		});
	const year = () =>
		act(async () => {
			const before = backup.fundedUntil;
			const waiver = waiverOf(withdrawal, waivedYear);
			waivedYear = false;
			const secret = await startBackupYear(master, waiver);
			const outcome = await checkout?.pay(secret);
			if (outcome === 'closed') return 'Das Jahr wurde nicht gekauft.';
			if (outcome === 'failed') throw new Error('Die Bezahlseite ließ sich nicht laden. Bitte später noch einmal.');
			note = 'Bezahlt – das Jahr wird gebucht …';
			const { booked, balance } = await waitForBackup(master, before);
			return booked ? `Gebucht: Die Sicherungen sind bis zum ${germanDate(balance?.backup?.fundedUntil ?? null)} bezahlt.` : 'Bezahlt; das Jahr erscheint in Kürze.';
		});
</script>

<div class="backup" data-testid="backup-line">
	<p class={status.tone} role={status.tone === 'warn' || status.tone === 'over' ? 'alert' : undefined} data-testid="backup-status" data-tone={status.tone}>{status.text}</p>
	{#if backup.retentionUntil && backup.active && !backup.renewsWithPlan && status.tone === 'ok'}
		<p class="hint">Nach dem Ende bleiben die Sicherungen noch bis zum {germanDate(backup.retentionUntil)} abrufbar.</p>
	{/if}

	{#if sold && offer}
		{#if canAdd}
			<details class="buy" data-testid="backup-add-fold" bind:open={addOpen}>
				<summary>Sicherung zum Abo hinzubuchen ({euro(offer.monthCents)} im Monat)</summary>
				<p class="hint">Stripe berechnet den Rest des laufenden Monats sofort anteilig. Danach verlängert sich die Sicherung mit dem Paket, nächste Abbuchung am {nextCharge}. Herausnehmen kannst du sie in der Abo-Verwaltung bei Stripe; der bezahlte Zeitraum läuft dann noch aus, und die Sicherungen bleiben danach {offer.retentionDays} Tage abrufbar.</p>
				<Waiver {withdrawal} bind:checked={waivedAdd} testid="backup-add-waiver" />
				<p class="row"><button class="small" onclick={add} disabled={disabled || busy || blocked(waivedAdd)} data-testid="backup-add">Sicherung für {euro(offer.monthCents)} im Monat hinzubuchen</button></p>
			</details>
		{:else if backup.renewsWithPlan}
			<p class="hint">Herausnehmen kannst du die Sicherung in der <button class="link" onclick={() => onportal()} disabled={disabled || busy} data-testid="backup-remove">Abo-Verwaltung bei Stripe</button>. Der bezahlte Zeitraum läuft dann noch aus, und die Sicherungen bleiben danach {offer.retentionDays} Tage abrufbar.</p>
		{/if}

		<details class="buy" data-testid="backup-year-fold" bind:open={yearOpen}>
			<summary>1 Jahr Aufbewahrung buchen ({euro(offer.yearCents)}, einmalig)</summary>
			<p><strong>Aufbewahren heißt nicht öffnen:</strong> Zum Wiederherstellen braucht es Rechenzeit, also ein laufendes Paket oder Zusatzstunden.</p>
			<p class="hint">{offer.yearDays} Tage, gerechnet ab heute oder, wenn schon länger bezahlt ist, ab dem bezahlten Ende. Zusätzlich zum Paket, keine Verlängerung, eigene Rechnung von Stripe.</p>
			<Waiver {withdrawal} bind:checked={waivedYear} testid="backup-year-waiver" />
			<p class="row"><button class="small" onclick={year} disabled={disabled || busy || blocked(waivedYear)} data-testid="backup-year">1 Jahr für {euro(offer.yearCents)} bezahlen</button></p>
		</details>
		{#if status.tone === 'soon' || status.tone === 'warn'}
			<p class="hint" data-testid="backup-mail-note">Eine Erinnerung kommt auch per E-Mail, an die Adresse aus deiner Kartenzahlung bei Stripe. Ohne Kartenzahlung steht der Hinweis nur hier.</p>
		{/if}
	{/if}
	{#if note}<p class="hint" role="status" data-testid="backup-note">{note}</p>{/if}
	{#if error}<p class="warn" role="alert" data-testid="backup-error">{error}</p>{/if}
</div>
<StripeCheckout bind:this={checkout} label="1 Jahr Aufbewahrung bezahlen" summary={offer ? `1 Jahr Aufbewahrung der Sicherungen: ${euro(offer.yearCents)}, einmalig, keine Verlängerung.` : ''} />

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
