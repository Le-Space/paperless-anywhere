// What the overview says about the backups of a running Paperless, read from
// the VM's private status page (paperless-status): the last backup that ran,
// the last check, when the next check is due, and a requested backup
// ("back up now"). The texts are in the catalogue (i18n/backup.js).
import { backup } from './i18n/backup.js';
import { currentLang, localeOf } from './i18n/index.js';

/**
 * @typedef {{
 *   supported: boolean,
 *   last: null | { ok: boolean, at: Date | null, copies: number, requested: number, reason: string | null, seconds: number | null },
 *   check: null | { status: string, at: Date | null },
 *   nextCheck: Date | null,
 *   running: boolean,
 *   request: null | { status: string, mode: string, at: Date | null, outcome: string | null, reason: string | null },
 *   log: string | null
 * }} BackupOverview
 */

const date = (/** @type {unknown} */ s) => {
	if (typeof s !== 'string' && typeof s !== 'number') return null;
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * @param {any} status the VM's status page (v2), or null
 * @returns {BackupOverview}
 */
export function backupOverview(status) {
	const backup = status?.backup ?? null;
	// An image older than this feature has none of the three fields.
	const supported = Boolean(status && ('backupSchedule' in status || 'lastBackup' in status || 'backupRequest' in status));
	const lastRaw = status?.lastBackup ?? (backup && ['done', 'partial', 'failed'].includes(backup.status) ? backup : null);
	const entry = lastRaw?.backup ?? null;
	const last = lastRaw
		? {
				// A partial backup is a backup: fewer copies than requested (one
				// provider refused the piece), shown as such.
				ok: ['done', 'partial'].includes(lastRaw.status),
				// The backup's own date (when the export was made), else when it was reported.
				at: date(entry?.date) ?? date(lastRaw.at),
				copies: entry?.copies?.length ?? 0,
				requested: entry?.requestedCopies ?? entry?.copies?.length ?? 0,
				reason: lastRaw.reason ?? null,
				seconds: typeof lastRaw.seconds === 'number' ? lastRaw.seconds : null
			}
		: null;
	const check = backup && backup.status !== 'running' ? { status: String(backup.status), at: date(backup.at) } : null;
	const req = status?.backupRequest ?? null;
	const request = req
		? {
				status: String(req.status),
				mode: String(req.mode ?? 'run'),
				at: date(req.at),
				outcome: req.backup?.status ?? null,
				reason: req.backup?.reason ?? null
			}
		: null;
	const running = backup?.status === 'running' || req?.status === 'running';
	const line = backup?.status === 'running' ? backup.log?.at?.(-1) : null;
	return {
		supported,
		last,
		check,
		nextCheck: date(status?.backupSchedule?.nextCheck),
		running,
		request,
		log: typeof line === 'string' ? line.replace(/^\S+Z /, '') : null
	};
}

/** A time, with the day when it is not today. @param {Date} d @param {'de' | 'en'} lang @param {Date} [now] */
export function when(d, lang, now = new Date()) {
	const locale = localeOf(lang);
	const sameDay = d.toDateString() === now.toDateString();
	return sameDay
		? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
		: d.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

/** The texts of the backup box, by language (from the catalogue). */
export const BACKUP_TEXTS = { de: backup.de.overview, en: backup.en.overview };

/** The language of these texts: the app's. */
export const backupLang = () => currentLang();
