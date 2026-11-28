// The auto-stop the person chooses (auto-stop.js): the setting, the secret
// for the VM, what the status page says about it, and when the app tells a
// running VM or erases one that stopped itself.
import { describe, expect, it, vi } from 'vitest';
import { autoStopChanged, autoStopSecret, autoStopSetting, autoStopWarning, imageKnowsAutoStop, nextAutoStop, postponed, stoppedItself, utcOffsetMinutes } from './auto-stop.js';

vi.mock('./attest-wasm-load.js', () => ({ loadAttestWasm: async () => ({}) }));
const { sendAutoStop, syncAutoStop } = await import('./lifecycle.js');

const WINTER = Date.parse('2027-01-15T08:00:00Z');
const SUMMER = Date.parse('2027-07-15T08:00:00Z');
const IDLE = { idleMinutes: 60, dailyAt: null, tz: 'Europe/Berlin' };
const iso = (/** @type {number} */ ms) => new Date(ms).toISOString().replace('.000', '');

describe('the setting', () => {
	it('keeps what the VM takes, and is off without a valid time', () => {
		expect(autoStopSetting(IDLE)).toEqual({ ...IDLE, postponeUntil: 0 });
		expect(autoStopSetting({ idleMinutes: null, dailyAt: '18:00', tz: 'Europe/Berlin', postponeUntil: 1_800_000_000 })).toEqual({ idleMinutes: null, dailyAt: '18:00', tz: 'Europe/Berlin', postponeUntil: 1_800_000_000 });
		for (const raw of [null, undefined, {}, { idleMinutes: 5 }, { idleMinutes: 1441 }, { idleMinutes: 30.5 }, { dailyAt: '24:00' }, { dailyAt: '8:00' }, 'x']) expect(autoStopSetting(raw), JSON.stringify(raw)).toBeNull();
		// A zone that is not a zone name goes; the VM then takes the offset.
		expect(autoStopSetting({ ...IDLE, tz: 'Europe/Berlin; rm' })?.tz).toBeNull();
	});
	it('goes to the VM with the zone’s offset at that moment', () => {
		expect(utcOffsetMinutes('Europe/Berlin', WINTER)).toBe(60);
		expect(utcOffsetMinutes('Europe/Berlin', SUMMER)).toBe(120);
		expect(utcOffsetMinutes('UTC', WINTER)).toBe(0);
		expect(utcOffsetMinutes('America/New_York', WINTER)).toBe(-300);
		expect(JSON.parse(autoStopSecret(autoStopSetting({ ...IDLE, dailyAt: '18:00' }), { now: SUMMER }))).toEqual({ v: 1, idleMinutes: 60, dailyAt: '18:00', tz: 'Europe/Berlin', utcOffsetMinutes: 120, postponeUntil: 0 });
		// Off: both null, which a VM holding a setting takes as off.
		expect(JSON.parse(autoStopSecret(null))).toEqual({ v: 1, idleMinutes: null, dailyAt: null });
	});
});

describe('what the status page says', () => {
	const knows = { capabilities: { autoStop: 1 } };
	const held = (/** @type {any} */ setting, /** @type {Record<string, any>} */ more = {}) => ({ ...knows, phase: 'ready', autoStop: { setting, ...more } });
	it('needs an image that can stop itself', () => {
		expect(imageKnowsAutoStop(knows)).toBe(true);
		expect(imageKnowsAutoStop({ capabilities: { v: 1 } })).toBe(false);
		expect(autoStopChanged({ phase: 'ready' }, autoStopSetting(IDLE))).toBe(false);
	});
	it('tells when the VM holds another setting', () => {
		const wanted = autoStopSetting(IDLE);
		expect(autoStopChanged(held({ ...IDLE, utcOffsetMinutes: 60 }), wanted)).toBe(false);
		expect(autoStopChanged(held(null), wanted)).toBe(true);
		expect(autoStopChanged(held({ ...IDLE, idleMinutes: 120 }), wanted)).toBe(true);
		expect(autoStopChanged(held({ ...IDLE, tz: 'Europe/London' }), wanted)).toBe(true);
		expect(autoStopChanged(held(IDLE), null)).toBe(true);
		expect(autoStopChanged(held(null), null)).toBe(false);
		// A postpone counts, to the minute.
		const later = { ...wanted, postponeUntil: WINTER / 1000 + 3600 };
		expect(autoStopChanged(held(IDLE), later)).toBe(true);
		expect(autoStopChanged(held(IDLE, { postponeUntil: iso(WINTER + 3600_000 + 20_000) }), later)).toBe(false);
	});
	it('names the next stop, the earlier one, not before a postpone, and warns ten minutes before', () => {
		const s = held(IDLE, { idleAt: iso(WINTER + 30 * 60_000), dailyAt: iso(WINTER + 9 * 3600_000) });
		expect(nextAutoStop(s)).toEqual({ at: WINTER + 30 * 60_000, reason: 'idle' });
		expect(nextAutoStop({ ...s, autoStop: { ...s.autoStop, postponeUntil: iso(WINTER + 3600_000) } })).toEqual({ at: WINTER + 3600_000, reason: 'idle' });
		expect(nextAutoStop({ ...s, phase: 'stopping' })).toBeNull();
		expect(nextAutoStop(held(null))).toBeNull();
		expect(autoStopWarning(s, WINTER + 19 * 60_000)).toBeNull();
		expect(autoStopWarning(s, WINTER + 20 * 60_000)).toEqual({ at: WINTER + 30 * 60_000, reason: 'idle' });
	});
	it('moves the stop an hour past the next one', () => {
		const s = held(IDLE, { idleAt: iso(WINTER + 5 * 60_000) });
		expect(postponed(autoStopSetting(IDLE), s, WINTER).postponeUntil).toBe((WINTER + 65 * 60_000) / 1000);
		expect(postponed(autoStopSetting(IDLE), null, WINTER).postponeUntil).toBe((WINTER + 60 * 60_000) / 1000);
	});
	it('a VM that stopped itself, in full, may be erased', () => {
		expect(stoppedItself({ phase: 'stopped', stopReason: 'idle' })).toBe(true);
		expect(stoppedItself({ phase: 'stopped', stopReason: 'schedule' })).toBe(true);
		expect(stoppedItself({ phase: 'stop-partial', stopReason: 'idle' })).toBe(false);
		expect(stoppedItself({ phase: 'stopped', stopReason: 'app' })).toBe(false);
	});
});

describe('handing the setting to the running VM', () => {
	const master = new Uint8Array(32).fill(7);
	const base = { backupConfig: { network: 'calibration' }, autoStop: IDLE, running: { instanceHash: 'c'.repeat(64), host: 'h' } };
	const ready = (/** @type {any} */ setting) => ({ phase: 'ready', capabilities: { autoStop: 1 }, autoStop: setting ? { setting } : null });
	it('sends the profile’s setting, and "off" when there is none', async () => {
		const send = vi.fn(async () => {});
		expect(JSON.parse(await sendAutoStop(master, base, { send, now: WINTER }))).toMatchObject({ idleMinutes: 60, utcOffsetMinutes: 60 });
		expect(JSON.parse(await sendAutoStop(master, { ...base, autoStop: null }, { send, now: WINTER }))).toEqual({ v: 1, idleMinutes: null, dailyAt: null });
		// Without backups there is nothing to stop for: off.
		expect(JSON.parse(await sendAutoStop(master, { ...base, backupConfig: null }, { send, now: WINTER }))).toEqual({ v: 1, idleMinutes: null, dailyAt: null });
		expect(send).toHaveBeenCalledTimes(3);
		await expect(sendAutoStop(master, { ...base, running: null }, { send })).rejects.toThrow();
	});
	it('tells a running VM at the opening only when it holds another setting', async () => {
		const send = vi.fn(async () => {});
		expect(await syncAutoStop(master, base, ready(IDLE), { send, now: WINTER })).toBeNull();
		expect(await syncAutoStop(master, base, ready(null), { send, now: WINTER })).not.toBeNull();
		expect(send).toHaveBeenCalledTimes(1);
	});
	it('leaves a VM alone that stops, has stopped, or cannot stop itself', async () => {
		const send = vi.fn(async () => {});
		for (const phase of ['stopping', 'stopped', 'stop-partial']) expect(await syncAutoStop(master, base, { ...ready(null), phase }, { send })).toBeNull();
		expect(await syncAutoStop(master, base, { phase: 'ready', capabilities: { v: 1 } }, { send })).toBeNull();
		expect(await syncAutoStop(master, { ...base, running: null }, ready(null), { send })).toBeNull();
		expect(send).not.toHaveBeenCalled();
	});
});

describe('the FORGET the VM sends itself (phase 3)', async () => {
	const { privateKeyToAccount } = await import('viem/accounts');
	const { alephPrivateKey } = await import('./keys/derive.js');
	const { SELF_FORGET_REASON, selfForgotten } = await import('./vm.js');
	const { finishSelfForgotten } = await import('./lifecycle.js');
	const { createHash } = await import('node:crypto');
	const master = new Uint8Array(32).fill(9);
	const app = privateKeyToAccount(alephPrivateKey(master));
	const payer = '0x' + 'b'.repeat(40);
	const instance = 'c'.repeat(64);
	const base = { backupConfig: { network: 'calibration' }, autoStop: IDLE, running: { instanceHash: instance, host: 'h', payer } };

	it('goes with the setting, signed by the app key for the payer, naming only this VM', async () => {
		const send = vi.fn(async () => {});
		const secret = JSON.parse(await sendAutoStop(master, base, { send, now: WINTER }));
		expect(secret.forget.api).toBe('https://api2.aleph.im');
		const m = secret.forget.message;
		expect(m).toMatchObject({ type: 'FORGET', sender: app.address });
		const content = JSON.parse(m.item_content);
		expect(content).toMatchObject({ address: payer, hashes: [instance], reason: SELF_FORGET_REASON });
		expect(m.item_hash).toBe(createHash('sha256').update(m.item_content).digest('hex'));
		expect(m.signature).toMatch(/^0x[0-9a-f]{130}$/);
		// Off still carries it (for the period end); without backups there is none.
		expect(JSON.parse(await sendAutoStop(master, { ...base, autoStop: null }, { send })).forget.message.type).toBe('FORGET');
		expect(JSON.parse(await sendAutoStop(master, { ...base, backupConfig: null }, { send }))).not.toHaveProperty('forget');
	});

	/** Aleph's answers by URL. @param {Record<string, any>} pages */
	const get = (pages) => async (/** @type {string} */ url) => {
		const key = Object.keys(pages).find((k) => url.endsWith(k));
		return key ? new Response(JSON.stringify(pages[key]), { status: 200 }) : new Response('{}', { status: 404 });
	};
	const forgetHash = 'a'.repeat(64);
	const forgetMessage = (/** @type {Record<string, any>} */ o = {}) => ({ status: 'processed', reception_time: '2027-01-15T17:12:00Z', message: { type: 'FORGET', sender: app.address, item_content: JSON.stringify({ address: payer, hashes: [instance], reason: SELF_FORGET_REASON, time: 1 }), ...o } });

	it('is recognised at the next opening only when this app key forgot the VM for itself', async () => {
		expect(await selfForgotten(app.address, instance, { get: get({ [instance]: { status: 'forgotten', forgotten_by: [forgetHash] }, [forgetHash]: forgetMessage() }) })).toEqual({ forget: forgetHash, at: '2027-01-15T17:12:00Z' });
		expect(await selfForgotten(app.address, instance, { get: get({ [instance]: { status: 'processed' } }) })).toBe(false);
		// Forgotten by the app's own stop, or by someone else: not this.
		const other = { [instance]: { status: 'forgotten', forgotten_by: [forgetHash] } };
		expect(await selfForgotten(app.address, instance, { get: get({ ...other, [forgetHash]: forgetMessage({ item_content: JSON.stringify({ address: payer, hashes: [instance], reason: 'paperless-anywhere stop' }) }) }) })).toBe(false);
		expect(await selfForgotten(app.address, instance, { get: get({ ...other, [forgetHash]: forgetMessage({ sender: '0x' + '1'.repeat(40) }) }) })).toBe(false);
		// Aleph does not answer: nothing known.
		expect(await selfForgotten(app.address, instance, { get: async () => null })).toBeNull();
	});

	it('lets the VM go from the profile and revokes the backup key, and nothing else', async () => {
		let stored = { ...base, lastGoodBackup: { at: 'x' } };
		const update = vi.fn(async (_m, change) => (stored = change(stored)));
		const revoke = vi.fn(async () => 'revoked');
		const found = { forget: forgetHash, at: null };
		expect(await finishSelfForgotten(master, base, { check: async () => found, update, revoke })).toBe(found);
		expect(stored).not.toHaveProperty('running');
		expect(stored.lastGoodBackup).toEqual({ at: 'x' });
		expect(revoke).toHaveBeenCalledWith(master, base, instance);
		// Not forgotten by itself, or Aleph silent: the profile stays as it is.
		const untouched = vi.fn();
		expect(await finishSelfForgotten(master, base, { check: async () => false, update: untouched, revoke })).toBeNull();
		expect(await finishSelfForgotten(master, base, { check: async () => null, update: untouched, revoke })).toBeNull();
		expect(untouched).not.toHaveBeenCalled();
		// A newer start meanwhile (another device): its VM stays in the profile.
		stored = { ...base, running: { instanceHash: 'd'.repeat(64) } };
		await finishSelfForgotten(master, base, { check: async () => found, update, revoke });
		expect(stored.running.instanceHash).toBe('d'.repeat(64));
	});
});
