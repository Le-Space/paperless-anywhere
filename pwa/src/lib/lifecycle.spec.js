import { describe, expect, it } from 'vitest';
import { BackupFailedError, requestBackup } from './lifecycle.js';
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
