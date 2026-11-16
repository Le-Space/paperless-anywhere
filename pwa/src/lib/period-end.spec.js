// The end of the paid time: when it is, what the VM is told, the warning,
// and when a VM that stopped itself may be erased.
import { describe, expect, it, vi } from 'vitest';
import { endWarning, paidUntil, periodEndChanged, periodEndPiece, periodEndSecret, stoppedAtPeriodEnd } from './period-end.js';

vi.mock('./attest-wasm-load.js', () => ({ loadAttestWasm: async () => ({}) }));
const { confirmPeriodEndBackup, periodEndFor, syncPeriodEnd } = await import('./lifecycle.js');

const NOW = Date.parse('2026-11-16T12:00:00Z');
const H = 3_600_000;
const plan = (/** @type {Record<string, any>} */ o = {}) => ({ plan: { id: 'v', periodStart: null, periodEnd: '2026-11-20T12:00:00Z', hoursLeft: null, billing: 'voucher', renewsAt: null, cancelAtPeriodEnd: false, ...o } });

describe('paidUntil', () => {
	it("is a voucher's period end", () => {
		expect(paidUntil(plan(), { pays: 'lespace', now: NOW })).toBe(Date.parse('2026-11-20T12:00:00Z'));
	});
	it('is earlier when the hours run out first', () => {
		expect(paidUntil(plan({ hoursLeft: 10 }), { pays: 'lespace', now: NOW })).toBe(NOW + 10 * H);
		expect(paidUntil(plan({ hoursLeft: 500 }), { pays: 'lespace', now: NOW })).toBe(Date.parse('2026-11-20T12:00:00Z'));
		expect(paidUntil(plan({ hoursLeft: -2 }), { pays: 'lespace', now: NOW })).toBe(NOW);
	});
	it('is the end of a cancelled package', () => {
		expect(paidUntil(plan({ billing: 'stripe', cancelAtPeriodEnd: true }), { pays: 'lespace', now: NOW })).toBe(Date.parse('2026-11-20T12:00:00Z'));
		expect(paidUntil(plan({ billing: 'credits', cancelAtPeriodEnd: true }), { pays: 'lespace', now: NOW })).toBe(Date.parse('2026-11-20T12:00:00Z'));
	});
	it('is null for a package that renews, without a plan, or when the package does not pay the VM', () => {
		expect(paidUntil(plan({ billing: 'stripe' }), { pays: 'lespace', now: NOW })).toBeNull();
		expect(paidUntil(plan({ billing: 'credits', hoursLeft: 3 }), { pays: 'lespace', now: NOW })).toBeNull();
		expect(paidUntil({ plan: null }, { pays: 'lespace', now: NOW })).toBeNull();
		expect(paidUntil(null, { pays: 'lespace', now: NOW })).toBeNull();
		for (const pays of ['app', 'wallet', null]) expect(paidUntil(plan(), { pays, now: NOW }), String(pays)).toBeNull();
	});
	it('is null for a voucher without an end or hours (always on, no date)', () => {
		expect(paidUntil(plan({ periodEnd: null }), { pays: 'lespace', now: NOW })).toBeNull();
		expect(paidUntil(plan({ periodEnd: 'not a date' }), { pays: 'lespace', now: NOW })).toBeNull();
	});
});

describe('the secret and when it changed', () => {
	it('is Unix seconds, or "0"', () => {
		expect(periodEndSecret(Date.parse('2026-11-20T12:00:00.900Z'))).toBe(String(Date.parse('2026-11-20T12:00:00Z') / 1000));
		expect(periodEndSecret(null)).toBe('0');
	});
	it('is sent when the VM holds another end, not for a minute', () => {
		const end = Date.parse('2026-11-20T12:00:00Z');
		expect(periodEndChanged({ periodEnd: end / 1000 }, end)).toBe(false);
		expect(periodEndChanged({ periodEnd: end / 1000 + 30 }, end)).toBe(false);
		expect(periodEndChanged({ periodEnd: end / 1000 + 3600 }, end)).toBe(true);
		expect(periodEndChanged({ periodEnd: null }, end)).toBe(true);
		expect(periodEndChanged({ periodEnd: end / 1000 }, null)).toBe(true);
		expect(periodEndChanged({ periodEnd: null }, null)).toBe(false);
	});
	it('is never sent to an image that knows no period end', () => {
		expect(periodEndChanged({ phase: 'ready' }, NOW)).toBe(false);
		expect(periodEndChanged(null, NOW)).toBe(false);
	});
});

describe('endWarning', () => {
	it('warns three days before, urgently one day before, and after the end', () => {
		const end = NOW + 100 * H;
		expect(endWarning(end, NOW)).toBeNull();
		expect(endWarning(end, end - 72 * H)).toBe('soon');
		expect(endWarning(end, end - 24 * H - 1)).toBe('soon');
		expect(endWarning(end, end - 24 * H)).toBe('urgent');
		expect(endWarning(end, end - 1)).toBe('urgent');
		expect(endWarning(end, end)).toBe('ended');
		expect(endWarning(null, NOW)).toBeNull();
	});
});

describe('the VM stopped at the end', () => {
	const stopped = (/** @type {any} */ backup, /** @type {any} */ last = null) => ({ phase: 'stopped', stopReason: 'period-end', stop: { status: 'ready', request: 'period-end-1', reason: 'period-end', backup }, lastBackup: last });
	it('is told apart from the app’s own stop', () => {
		expect(stoppedAtPeriodEnd(stopped({ status: 'done' }))).toBe(true);
		expect(stoppedAtPeriodEnd({ phase: 'stopped', stopReason: 'app' })).toBe(false);
		expect(stoppedAtPeriodEnd({ phase: 'stopped' })).toBe(false);
		expect(stoppedAtPeriodEnd({ phase: 'stop-partial', stopReason: 'period-end' })).toBe(false);
	});
	it('leaves its own backup, or the one that ran when it began', () => {
		expect(periodEndPiece(stopped({ status: 'done', backup: { pieceCid: 'bafkstop' } }))).toBe('bafkstop');
		expect(periodEndPiece(stopped({ status: 'unchanged' }, { status: 'done', backup: { pieceCid: 'bafklast' } }))).toBe('bafklast');
		expect(periodEndPiece(stopped({ status: 'unchanged' }, { status: 'failed' }))).toBeNull();
		expect(periodEndPiece(stopped(null))).toBeNull();
	});
	it('is erased only once that backup is on the chain and new', async () => {
		const status = stopped({ status: 'done', backup: { pieceCid: 'bafkstop' } });
		await expect(confirmPeriodEndBackup(status, { onChain: async () => ['bafkold', 'bafkstop'], tries: 1, delayMs: 0 })).resolves.toBe('bafkstop');
		await expect(confirmPeriodEndBackup(status, { onChain: async () => ['bafkold'], tries: 2, delayMs: 0 })).rejects.toThrow();
		await expect(confirmPeriodEndBackup(status, { onChain: async () => ['bafkstop'], known: ['bafkstop'], tries: 1, delayMs: 0 })).rejects.toThrow();
		await expect(confirmPeriodEndBackup(stopped(null), { onChain: async () => ['bafkstop'], tries: 1, delayMs: 0 })).rejects.toThrow();
	});
});

describe('handing the end to the VM', () => {
	const master = new Uint8Array(32).fill(7);
	const base = { leSpacePays: true, backupConfig: { network: 'calibration' }, running: { instanceHash: 'c'.repeat(64), host: 'h' } };
	const end = Date.parse('2026-11-20T12:00:00Z') / 1000;
	it('is the period end for a package that pays the VM and backs it up', async () => {
		expect(await periodEndFor(master, base, { read: async () => plan(), now: NOW })).toBe(String(end));
		expect(await periodEndFor(master, base, { read: async () => plan({ billing: 'stripe' }), now: NOW })).toBe('0');
		expect(await periodEndFor(master, { ...base, leSpacePays: false, appPays: true }, { read: async () => plan(), now: NOW })).toBe('0');
		expect(await periodEndFor(master, { ...base, backupConfig: null }, { read: async () => plan(), now: NOW })).toBe('0');
		expect(await periodEndFor(master, base, { read: async () => null, now: NOW })).toBe('0');
	});
	it('says nothing when Le Space Credits does not answer', async () => {
		expect(await periodEndFor(master, base, { read: async () => { throw new Error('down'); }, now: NOW })).toBeNull();
	});
	it('tells a running VM only when the end changed', async () => {
		const send = vi.fn(async () => {});
		const read = async () => plan();
		expect(await syncPeriodEnd(master, base, { phase: 'ready', periodEnd: end }, { send, read, now: NOW })).toBeNull();
		expect(await syncPeriodEnd(master, base, { phase: 'ready', periodEnd: null }, { send, read, now: NOW })).toBe(String(end));
		expect(send).toHaveBeenLastCalledWith(master, base, { period_end: String(end) });
		// A new package that renews: the VM forgets the end.
		expect(await syncPeriodEnd(master, base, { phase: 'ready', periodEnd: end }, { send, read: async () => plan({ billing: 'stripe' }), now: NOW })).toBe('0');
		expect(send).toHaveBeenCalledTimes(2);
	});
	it('leaves a VM alone that stops, has stopped, or knows no period end', async () => {
		const send = vi.fn(async () => {});
		for (const phase of ['stopping', 'stopped', 'stop-partial']) await syncPeriodEnd(master, base, { phase, periodEnd: null }, { send, read: async () => plan(), now: NOW });
		await syncPeriodEnd(master, base, { phase: 'ready' }, { send, read: async () => plan(), now: NOW });
		await syncPeriodEnd(master, { ...base, running: null }, { phase: 'ready', periodEnd: null }, { send, read: async () => plan(), now: NOW });
		expect(send).not.toHaveBeenCalled();
	});
});
