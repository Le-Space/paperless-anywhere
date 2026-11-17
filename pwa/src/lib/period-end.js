// The end of the paid time, and what the app and the VM do about it.
//
// A voucher's period, or a package that was cancelled, ends and does not
// renew. After that the VM runs on Aleph's start reserve until the
// sub-account's credits are used up (a 7-day voucher: about day 8), and Aleph
// stops it; whatever came in since the last two-hourly backup would be lost.
// So the app hands the VM the end (secret `period_end`, Unix seconds; "0" for
// none), and the VM makes its last backup and stops Paperless an hour before
// it (rootfs/files/paperless-period-end). The app warns before the end, and
// erases the stopped VM at its next opening once that backup is on the chain.

/** Before the end, the overview warns from this many hours on. */
export const WARN_HOURS = 72;
/** …and urgently from this many. */
export const URGENT_HOURS = 24;
/** The VM's last backup starts this long before the end (paperless-period-end's LEAD). */
export const LEAD_SECONDS = 3600;

/**
 * When the paid time ends, in ms, or null when it renews or is not known.
 * Only for a VM that the package pays (Le Space, model A); a VM paid by the
 * app's address or a wallet does not stop with the package. A plan that does
 * not renew (a voucher, or one cancelled at the period's end) ends at its
 * period's end, or earlier when its hours run out while Paperless runs.
 * @param {{ plan?: { periodEnd: string | null, hoursLeft: number | null, billing: string, cancelAtPeriodEnd: boolean } | null } | null | undefined} balance creditsBalance()
 * @param {{ pays: string | null, now?: number }} o
 * @returns {number | null}
 */
export function paidUntil(balance, { pays, now = Date.now() }) {
	const plan = balance?.plan;
	if (!plan || pays !== 'lespace') return null;
	const renews = plan.billing !== 'voucher' && !plan.cancelAtPeriodEnd;
	if (renews) return null;
	const period = plan.periodEnd ? Date.parse(plan.periodEnd) : NaN;
	const hours = plan.hoursLeft == null || !Number.isFinite(plan.hoursLeft) ? NaN : now + Math.max(0, plan.hoursLeft) * 3_600_000;
	const ends = [period, hours].filter((t) => Number.isFinite(t));
	return ends.length ? Math.min(...ends) : null;
}

/**
 * The secret the VM gets: Unix seconds, or "0" for no end.
 * @param {number | null} endsAt ms
 */
export const periodEndSecret = (endsAt) => (endsAt == null ? '0' : String(Math.floor(endsAt / 1000)));

/**
 * Whether the VM holds another end than `endsAt` and must be told. An image
 * without the period end (no `periodEnd` on its status page) is not told:
 * it would not act on it. Ends within a minute count as the same.
 * @param {any} status the VM's private status page
 * @param {number | null} endsAt ms
 */
export function periodEndChanged(status, endsAt) {
	if (!status || !('periodEnd' in status)) return false;
	const held = Number(status.periodEnd) > 0 ? Number(status.periodEnd) : null;
	const wanted = endsAt == null ? null : Math.floor(endsAt / 1000);
	if (held == null || wanted == null) return held !== wanted;
	return Math.abs(held - wanted) >= 60;
}

/**
 * The warning before the end: null while it is far, 'soon' within three days,
 * 'urgent' within a day, 'ended' after it.
 * @param {number | null} endsAt ms @param {number} [now]
 * @returns {null | 'soon' | 'urgent' | 'ended'}
 */
export function endWarning(endsAt, now = Date.now()) {
	if (endsAt == null) return null;
	const left = endsAt - now;
	if (left <= 0) return 'ended';
	if (left <= URGENT_HOURS * 3_600_000) return 'urgent';
	if (left <= WARN_HOURS * 3_600_000) return 'soon';
	return null;
}

/**
 * The VM stopped itself at the end of the paid time (paperless-stop, reason
 * "period-end") and its last backup went up in full: the app may erase it
 * once that backup is on the chain. A partial one waits for the person.
 * @param {any} status the VM's private status page
 */
export const stoppedAtPeriodEnd = (status) => status?.phase === 'stopped' && status?.stopReason === 'period-end';

/**
 * The backup that the period-end stop leaves: its own piece, or, when the
 * stop found nothing new since a backup that was running when it began
 * ("unchanged"), that backup's. Null when there is none.
 * @param {any} status
 * @returns {string | null}
 */
export function periodEndPiece(status) {
	const b = status?.stop?.backup;
	const own = b?.backup?.pieceCid ?? b?.pieceCid ?? null;
	if (own) return String(own);
	const last = status?.lastBackup;
	const lastPiece = last?.status === 'done' ? (last.backup?.pieceCid ?? last.pieceCid ?? null) : null;
	if (b?.status === 'unchanged' && lastPiece) return String(lastPiece);
	return null;
}
