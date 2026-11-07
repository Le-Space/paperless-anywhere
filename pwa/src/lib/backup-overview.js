// What the overview says about the backups of a running Paperless, read from
// the VM's private status page (paperless-status): the last backup that ran,
// the last check, when the next check is due, and a requested backup
// ("Jetzt sichern"). The texts in German and English (same keys); the rest of
// the app is German for now, so the language follows the landing page's choice.
import { initialLang } from './landing/i18n.js';

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
	const lastRaw = status?.lastBackup ?? (backup && ['done', 'failed'].includes(backup.status) ? backup : null);
	const entry = lastRaw?.backup ?? null;
	const last = lastRaw
		? {
				ok: lastRaw.status === 'done',
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
	const locale = lang === 'de' ? 'de-DE' : 'en-GB';
	const sameDay = d.toDateString() === now.toDateString();
	return sameDay
		? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
		: d.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

export const BACKUP_TEXTS = {
	de: {
		title: 'Sicherung',
		last: 'Letzte Sicherung',
		none: 'Seit dem Start noch keine Sicherung',
		ok: (copies, requested) => (requested === 1 ? 'die Kopie ist angekommen' : `alle ${requested} Kopien angekommen`),
		short: (copies, requested) => `nur ${copies} von ${requested} Kopien`,
		failed: 'fehlgeschlagen',
		reason: 'Grund',
		checked: 'Zuletzt geprüft',
		unchanged: 'nichts geändert',
		skipped: 'Sicherungen sind aus',
		next: 'Nächste Prüfung',
		nextHint: 'gesichert wird nur, wenn sich etwas geändert hat',
		now: 'Jetzt sichern',
		running: 'Sicherung läuft …',
		sending: 'Sicherung anfordern …',
		doneNow: 'Gesichert',
		doneUnchanged: 'Schon gesichert: seit der letzten Sicherung hat sich nichts geändert.',
		failedNow: 'Die Sicherung ist fehlgeschlagen; Paperless läuft weiter.',
		oldImage: 'Diese VM läuft mit einem älteren Image: Sicherungsstand und „Jetzt sichern“ gibt es ab dem nächsten Image.',
		unreachable: 'Die VM meldet ihren Sicherungsstand gerade nicht.',
		duration: (s) => `Dauer ${s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`}`
	},
	en: {
		title: 'Backup',
		last: 'Last backup',
		none: 'No backup since the start yet',
		ok: (copies, requested) => (requested === 1 ? 'the copy arrived' : `all ${requested} copies arrived`),
		short: (copies, requested) => `only ${copies} of ${requested} copies`,
		failed: 'failed',
		reason: 'Reason',
		checked: 'Last checked',
		unchanged: 'nothing changed',
		skipped: 'backups are off',
		next: 'Next check',
		nextHint: 'a backup is made only if something changed',
		now: 'Back up now',
		running: 'Backing up …',
		sending: 'Requesting a backup …',
		doneNow: 'Backed up',
		doneUnchanged: 'Already backed up: nothing changed since the last backup.',
		failedNow: 'The backup failed; Paperless keeps running.',
		oldImage: 'This VM runs an older image: backup details and “Back up now” come with the next image.',
		unreachable: 'The VM does not report its backups right now.',
		duration: (s) => `took ${s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`}`
	}
};

/** The language of these texts: the landing page's choice, else the browser's. */
export const backupLang = () => initialLang();
