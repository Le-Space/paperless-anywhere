import { describe, expect, it } from 'vitest';
import { BACKUP_TEXTS, backupOverview, when } from './backup-overview.js';

const entry = { name: 'paperless-made-up', date: '2026-01-02T03:04:05Z', pieceCid: 'bafkzcibmadeup', complete: true, requestedCopies: 2, copies: [{ providerId: 1 }, { providerId: 2 }] };

describe('backupOverview', () => {
	it('an older image has none of the new fields', () => {
		expect(backupOverview({ v: 2, phase: 'ready', backup: { status: 'unchanged', at: '2026-01-02T05:00:00Z' } }).supported).toBe(false);
		expect(backupOverview(null).supported).toBe(false);
	});

	it('keeps the last backup apart from a later unchanged check', () => {
		const v = backupOverview({
			backup: { status: 'unchanged', at: '2026-01-02T05:00:00Z' },
			lastBackup: { status: 'done', at: '2026-01-02T03:10:00Z', backup: entry, seconds: 400 },
			backupSchedule: { nextCheck: '2026-01-02T07:00:00Z', everySeconds: 7200 },
			backupRequest: null
		});
		expect(v.supported).toBe(true);
		expect(v.last).toEqual({ ok: true, at: new Date(entry.date), copies: 2, requested: 2, reason: null, seconds: 400 });
		expect(v.check).toEqual({ status: 'unchanged', at: new Date('2026-01-02T05:00:00Z') });
		expect(v.nextCheck).toEqual(new Date('2026-01-02T07:00:00Z'));
		expect(v.running).toBe(false);
	});

	it('a failed backup carries its reason and how many copies arrived', () => {
		const v = backupOverview({ backupSchedule: {}, lastBackup: { status: 'failed', at: '2026-01-02T03:10:00Z', reason: 'only 1 of 2 copies reached the providers', backup: { ...entry, complete: false, copies: [{ providerId: 1 }] } } });
		expect(v.last).toMatchObject({ ok: false, copies: 1, requested: 2, reason: 'only 1 of 2 copies reached the providers' });
	});

	it('a partial backup counts as a backup with copies short', () => {
		const v = backupOverview({ backupSchedule: {}, lastBackup: { status: 'partial', at: '2026-01-02T03:10:00Z', reason: 'only 1 of 2 copies reached the providers', backup: { ...entry, complete: false, copies: [{ providerId: 1 }] } } });
		expect(v.last).toMatchObject({ ok: true, copies: 1, requested: 2 });
		expect(BACKUP_TEXTS.de.checkOutcome('partial')).toBe('nur teilweise gesichert');
	});

	it('a failure without an entry is dated by its report', () => {
		const v = backupOverview({ backupSchedule: {}, backup: { status: 'failed', at: '2026-01-02T03:10:00Z', reason: 'could not read Paperless’s state' } });
		expect(v.last).toMatchObject({ ok: false, at: new Date('2026-01-02T03:10:00Z'), copies: 0 });
	});

	it('a running backup shows its latest log line without the timestamp', () => {
		const v = backupOverview({ backupSchedule: {}, backup: { status: 'running', log: ['2026-01-02T03:04:05.000Z export', '2026-01-02T03:05:05.000Z upload to provider 2'] }, backupRequest: { status: 'running', mode: 'run', at: '2026-01-02T03:04:00Z' } });
		expect(v.running).toBe(true);
		expect(v.check).toBeNull();
		expect(v.log).toBe('upload to provider 2');
		expect(v.request).toMatchObject({ status: 'running', mode: 'run' });
	});
});

describe('texts', () => {
	it('German and English have the same keys', () => {
		expect(Object.keys(BACKUP_TEXTS.en).sort()).toEqual(Object.keys(BACKUP_TEXTS.de).sort());
	});

	it('say a single copy in the singular', () => {
		expect(BACKUP_TEXTS.de.ok(1, 1)).toBe('die Kopie ist angekommen');
		expect(BACKUP_TEXTS.en.ok(2, 2)).toBe('all 2 copies arrived');
	});

	it('when: the time today, the day otherwise', () => {
		const now = new Date(2026, 0, 2, 12, 0);
		expect(when(new Date(2026, 0, 2, 9, 5), 'de', now)).toBe('09:05');
		expect(when(new Date(2026, 0, 1, 9, 5), 'de', now)).toMatch(/^01\.01\.26/);
	});
});

describe('check outcomes', () => {
	it('name what the last check did, in both languages', () => {
		for (const lang of /** @type {const} */ (['de', 'en'])) {
			for (const s of ['unchanged', 'skipped', 'done', 'failed']) expect(BACKUP_TEXTS[lang].checkOutcome(s)).toMatch(/\S/);
		}
		expect(BACKUP_TEXTS.de.checkOutcome('unchanged')).toBe('keine Änderung');
	});
});
