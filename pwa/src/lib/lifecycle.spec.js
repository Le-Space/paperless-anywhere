import { describe, expect, it } from 'vitest';
import { BackupFailedError, BackupPartialError, requestBackup, resumeAfterPartial, stopPaperless } from './lifecycle.js';
import { newMasterSecret, statusToken } from './keys/derive.js';

const master = newMasterSecret();
const profile = { running: { instanceHash: 'c'.repeat(64), crnHash: 'd'.repeat(64), host: 'vm.example.test' } };
const fast = { delayMs: 1, tries: 20 };

/** A guest whose status page answers from a list, one per read; the last one stays. */
function guest(pages) {
	const reads = [];
	const sent = [];
	return {
		sent,
		reads,
		send: async (_m, _p, secrets) => void sent.push(secrets),
		status: async (host, token) => {
			reads.push({ host, token });
			return pages.length > 1 ? pages.shift() : pages[0];
		}
	};
}

const base = { v: 2, phase: 'ready', backupSchedule: { nextCheck: '2026-01-02T07:00:00Z', everySeconds: 7200 } };

describe('requestBackup', () => {
	it('sends a backup request and follows the page until it is done', async () => {
		const g = guest([
			{ ...base, backupRequest: { status: 'done', mode: 'run', at: 'earlier' } },
			{ ...base, backupRequest: { status: 'done', mode: 'run', at: 'earlier' } },
			{ ...base, backup: { status: 'running', log: ['2026-01-02T03:04:05Z export'] }, backupRequest: { status: 'running', mode: 'run', at: 't1' } },
			{ ...base, backup: { status: 'done' }, backupRequest: { status: 'done', mode: 'run', at: 't2', backup: { status: 'done' } } }
		]);
		const seen = [];
		const done = await requestBackup(master, profile, ({ detail }) => seen.push(detail), { ...fast, send: g.send, status: g.status });
		expect(g.sent).toHaveLength(1);
		expect(Object.keys(g.sent[0])).toEqual(['backup_request']);
		expect(g.sent[0].backup_request).toMatch(/^\d+$/);
		expect(seen).toEqual(['requested', 'running', 'done']);
		expect(done.backupRequest.at).toBe('t2');
		// Only the private page, by the vault's token.
		expect(g.reads.every((r) => r.host === 'vm.example.test' && r.token === statusToken(master))).toBe(true);
	});

	it('a failed request throws with the VM’s reason and log', async () => {
		const g = guest([
			{ ...base, backupRequest: null },
			{ ...base, backupRequest: { status: 'failed', mode: 'run', at: 't1', backup: { status: 'failed', reason: 'the backup did not complete (exit 1)', log: ['error: made up'], exit: 1 } } }
		]);
		const error = await requestBackup(master, profile, () => {}, { ...fast, send: g.send, status: g.status }).catch((e) => e);
		expect(error).toBeInstanceOf(BackupFailedError);
		expect(error.reason).toBe('the backup did not complete (exit 1)');
		expect(error.log).toEqual(['error: made up']);
		expect(error.facts).toContain('Exit-Code 1');
	});

	it('refuses on an image that does not know the request', async () => {
		const g = guest([{ v: 2, phase: 'ready', backup: { status: 'unchanged' } }]);
		await expect(requestBackup(master, profile, () => {}, { ...fast, send: g.send, status: g.status })).rejects.toThrow(/älteres Image/);
		expect(g.sent).toHaveLength(0);
	});

	it('needs a running VM', async () => {
		await expect(requestBackup(master, {}, () => {})).rejects.toThrow('Es läuft keine VM.');
	});
});

const entry = (have, want) => ({ pieceCid: 'bafkzcibmadeup', requestedCopies: want, complete: have >= want, copies: Array.from({ length: have }, (_, i) => ({ providerId: i + 1 })) });

describe('stopPaperless', () => {
	const erase = async (_m, _p, status) => ({ erased: true, status });

	it('does not take an earlier stop’s outcome for the new one', async () => {
		const old = { ...base, phase: 'stop-failed', stop: { status: 'failed', request: '1', at: 't0', backup: { status: 'failed', reason: 'made up' } } };
		const g = guest([old, old, old, { ...base, phase: 'stopping', stop: { status: 'running', request: 'NEW', at: 't1' } }, { ...base, phase: 'stopped', stop: { status: 'ready', request: 'NEW', at: 't2', backup: { status: 'done' } } }]);
		// The page names the request the app just sent ("NEW" stands for it).
		let request = '';
		const send = async (_m, _p, secrets) => void (request = secrets.stop_request);
		const status = async (h, t) => {
			const s = await g.status(h, t);
			return s.stop?.request === 'NEW' ? { ...s, stop: { ...s.stop, request } } : s;
		};
		const out = await stopPaperless(master, profile, () => {}, { ...fast, send, status, erase });
		expect(out.erased).toBe(true);
		expect(out.status.stop.status).toBe('ready');
	});

	it('an image without the request field is told apart by the time', async () => {
		const old = { ...base, phase: 'stop-failed', stop: { status: 'failed', at: 't0', backup: { status: 'failed', reason: 'made up' } } };
		const g = guest([old, old, { ...base, phase: 'stopped', stop: { status: 'ready', at: 't1', backup: { status: 'done' } } }]);
		const out = await stopPaperless(master, profile, () => {}, { ...fast, send: g.send, status: g.status, erase });
		expect(out.status.stop.at).toBe('t1');
	});

	it('a partial backup asks instead of erasing', async () => {
		let request = '';
		const send = async (_m, _p, secrets) => void (request = secrets.stop_request);
		const status = async () => ({ ...base, phase: 'stop-partial', stop: { status: 'partial', request, at: 't1', backup: { status: 'partial', reason: 'only 1 of 2 copies reached the providers', backup: entry(1, 2), log: ['made up'] } } });
		let erased = false;
		const error = await stopPaperless(master, profile, () => {}, { ...fast, send, status, erase: async () => void (erased = true) }).catch((e) => e);
		expect(error).toBeInstanceOf(BackupPartialError);
		expect([error.copies, error.requested]).toEqual([1, 2]);
		expect(error.message).toMatch(/nur 1 von 2 Kopien/);
		expect(erased).toBe(false);
	});

	it('a failed backup still throws BackupFailedError', async () => {
		let request = '';
		const send = async (_m, _p, secrets) => void (request = secrets.stop_request);
		const status = async () => ({ ...base, phase: 'stop-failed', stop: { status: 'failed', request, at: 't1', backup: { status: 'failed', reason: 'made up' } } });
		await expect(stopPaperless(master, profile, () => {}, { ...fast, send, status, erase })).rejects.toBeInstanceOf(BackupFailedError);
	});
});

describe('resumeAfterPartial', () => {
	it('sends stop_resume naming the partial stop, and waits for "resumed"', async () => {
		const g = guest([{ ...base, phase: 'stop-partial', stop: { status: 'partial', request: '1700000000000' } }, { ...base, phase: 'ready', stop: { status: 'resumed', request: '1700000000000' } }]);
		const s = await resumeAfterPartial(master, profile, { ...fast, send: g.send, status: g.status });
		expect(g.sent).toEqual([{ stop_resume: '1700000000000' }]);
		expect(s.stop.status).toBe('resumed');
	});

	it('sends nothing when no stop waits any more', async () => {
		const g = guest([{ ...base, phase: 'ready', stop: { status: 'resumed', request: '1' } }]);
		await expect(resumeAfterPartial(master, profile, { ...fast, send: g.send, status: g.status })).rejects.toThrow(/wartet auf keine Antwort/);
		expect(g.sent).toHaveLength(0);
	});
});

describe('requestBackup, partial', () => {
	it('a partial backup is no failure', async () => {
		const g = guest([{ ...base, backupRequest: null }, { ...base, backupRequest: { status: 'partial', mode: 'run', at: 't1', backup: { status: 'partial', backup: entry(1, 2) } } }]);
		const done = await requestBackup(master, profile, () => {}, { ...fast, send: g.send, status: g.status });
		expect(done.backupRequest.status).toBe('partial');
	});
});
