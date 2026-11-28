// The auto-stop the person chooses (docs/auto-stop.md): the VM backs up and
// pauses after a quiet time, or daily at an hour in the person's time zone.
// The setting lives in the sealed profile (`autoStop`), so it follows the
// person to every device; the VM gets it as the secret `auto_stop`
// (rootfs/files/paperless-auto-stop) at the start, with every hand-over of
// the backup places, and whenever it changes. At the next opening the app
// erases a VM that stopped this way, once its last backup is on the chain,
// as after the end of the paid time (period-end.js).

/** The quiet times the form offers, in minutes; another value from MIN to MAX. */
export const IDLE_CHOICES = Object.freeze([30, 60, 120]);
export const MIN_IDLE = 15;
export const MAX_IDLE = 1440;
/** While the app is open, it warns this long before a stop. */
export const WARN_MINUTES = 10;
/** "Later" moves the stop by this much. */
export const POSTPONE_MINUTES = 60;

/**
 * @typedef {{ idleMinutes: number | null, dailyAt: string | null, tz: string | null, postponeUntil?: number }} AutoStop
 * postponeUntil: Unix seconds, 0 or missing for none.
 */

const DAILY = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const ZONE = /^[A-Za-z0-9_+/-]{1,64}$/;

/** The browser's own IANA time zone, or null. */
export function ownZone() {
	try {
		const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
		return typeof z === 'string' && ZONE.test(z) ? z : null;
	} catch {
		return null;
	}
}

/**
 * The profile's setting as the VM takes it, or null when auto-stop is off
 * (nothing set, or nothing valid).
 * @param {any} raw profile.autoStop
 * @returns {AutoStop | null}
 */
export function autoStopSetting(raw) {
	if (!raw || typeof raw !== 'object') return null;
	const idle = Number.isInteger(raw.idleMinutes) && raw.idleMinutes >= MIN_IDLE && raw.idleMinutes <= MAX_IDLE ? raw.idleMinutes : null;
	const daily = typeof raw.dailyAt === 'string' && DAILY.test(raw.dailyAt) ? raw.dailyAt : null;
	if (idle == null && daily == null) return null;
	const tz = typeof raw.tz === 'string' && ZONE.test(raw.tz) ? raw.tz : null;
	const postponeUntil = Number.isInteger(raw.postponeUntil) && raw.postponeUntil > 0 ? raw.postponeUntil : 0;
	return { idleMinutes: idle, dailyAt: daily, tz, postponeUntil };
}

/**
 * The UTC offset of `tz` at `now`, in minutes (Berlin in winter: 60), from
 * the browser's own clock when the zone is unknown.
 * @param {string | null} tz @param {number} now ms
 */
export function utcOffsetMinutes(tz, now) {
	if (tz) {
		try {
			const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date(now)).find((p) => p.type === 'timeZoneName')?.value ?? '';
			if (name === 'GMT') return 0;
			const m = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name);
			if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
		} catch {
			/* the browser's own */
		}
	}
	return -new Date(now).getTimezoneOffset();
}

/**
 * The secret `auto_stop` for a setting; with null, the "off" value (both
 * null), which a VM holding a setting takes as off. `forget`: the signed
 * FORGET of the VM and the API to send it to (paperless-self-forget).
 * @param {AutoStop | null} setting @param {{ now?: number, forget?: { api: string, message: any } | null }} [o]
 */
export function autoStopSecret(setting, { now = Date.now(), forget = null } = {}) {
	// The FORGET the VM sends itself after a stop of its own (phase 3), also when
	// only the period end stops it.
	const more = forget ? { forget } : {};
	if (!setting) return JSON.stringify({ v: 1, idleMinutes: null, dailyAt: null, ...more });
	return JSON.stringify({
		v: 1,
		idleMinutes: setting.idleMinutes,
		dailyAt: setting.dailyAt,
		tz: setting.tz,
		utcOffsetMinutes: utcOffsetMinutes(setting.tz, now),
		postponeUntil: setting.postponeUntil ?? 0,
		...more
	});
}

/**
 * Whether the VM's image can stop itself (capability autoStop, paperless-status).
 * @param {any} status the VM's private status page
 */
export const imageKnowsAutoStop = (status) => Number(status?.capabilities?.autoStop) >= 1;

/**
 * Whether the VM holds another setting than `wanted` and must be told. An
 * image without auto-stop is not told: it would not act on it.
 * @param {any} status @param {AutoStop | null} wanted
 */
export function autoStopChanged(status, wanted) {
	if (!imageKnowsAutoStop(status)) return false;
	const held = status?.autoStop?.setting ?? null;
	if (!held || !wanted) return Boolean(held) !== Boolean(wanted);
	const heldPostpone = status.autoStop?.postponeUntil ? Math.floor(Date.parse(status.autoStop.postponeUntil) / 1000) : 0;
	return (
		(held.idleMinutes ?? null) !== wanted.idleMinutes ||
		(held.dailyAt ?? null) !== wanted.dailyAt ||
		(held.tz ?? null) !== wanted.tz ||
		Math.abs(heldPostpone - (wanted.postponeUntil ?? 0)) >= 60
	);
}

/**
 * When the VM will stop itself if nothing happens until then, by the status
 * page: the earlier of the quiet and the daily stop, not before a postpone.
 * Null when it holds no setting.
 * @param {any} status
 * @returns {{ at: number, reason: 'idle' | 'schedule' } | null} at: ms
 */
export function nextAutoStop(status) {
	const a = status?.autoStop;
	if (!a?.setting || status?.phase !== 'ready') return null;
	const idle = a.idleAt ? Date.parse(a.idleAt) : NaN;
	const daily = a.dailyAt ? Date.parse(a.dailyAt) : NaN;
	const later = a.postponeUntil ? Date.parse(a.postponeUntil) : NaN;
	/** @type {{ at: number, reason: 'idle' | 'schedule' }[]} */
	const all = [];
	if (Number.isFinite(idle)) all.push({ at: idle, reason: 'idle' });
	if (Number.isFinite(daily)) all.push({ at: daily, reason: 'schedule' });
	if (!all.length) return null;
	const first = all.sort((x, y) => x.at - y.at)[0];
	return Number.isFinite(later) && later > first.at ? { ...first, at: later } : first;
}

/**
 * The warning while the app is open: the next stop when it is WARN_MINUTES
 * away or less, else null.
 * @param {any} status @param {number} [now]
 */
export function autoStopWarning(status, now = Date.now()) {
	const next = nextAutoStop(status);
	return next && next.at - now <= WARN_MINUTES * 60_000 ? next : null;
}

/**
 * The setting with its stop moved POSTPONE_MINUTES past the next one (or
 * from now, when none is known).
 * @param {AutoStop} setting @param {any} status @param {number} [now]
 * @returns {AutoStop}
 */
export function postponed(setting, status, now = Date.now()) {
	const from = Math.max(now, nextAutoStop(status)?.at ?? now);
	return { ...setting, postponeUntil: Math.floor((from + POSTPONE_MINUTES * 60_000) / 1000) };
}

/**
 * The VM stopped itself as the person chose (paperless-stop, reason "idle"
 * or "schedule"), with its last backup in full: the app may erase it once
 * that backup is on the chain. A partial one waits for the person.
 * @param {any} status
 */
export const stoppedItself = (status) => status?.phase === 'stopped' && (status?.stopReason === 'idle' || status?.stopReason === 'schedule');
