import { afterEach, describe, expect, it, vi } from 'vitest';
import { vmPayer } from './profile.js';
import { resumeStart, startRequirements } from './lifecycle.js';

const app = '0x00000000000000000000000000000000000000A1';
const wallet = '0x00000000000000000000000000000000000000B2';
const ready = { rootfsItemHash: 'a'.repeat(64), luksPassphrase: 'x', crnHash: 'b'.repeat(64) };

describe('vmPayer', () => {
	it('is the wallet unless the app pays', () => {
		expect(vmPayer({ payer: wallet }, app)).toBe(wallet);
		expect(vmPayer({ payer: wallet, appPays: true }, app)).toBe(app);
		expect(vmPayer({ appPays: true }, app)).toBe(app);
		expect(vmPayer({}, app)).toBeUndefined();
	});
});

describe('startRequirements', () => {
	it('needs a wallet only to pay, or for backups when the app pays', () => {
		expect(startRequirements({ ...ready })).toEqual(['zahlendes Konto']);
		expect(startRequirements({ ...ready, payer: wallet })).toEqual([]);
		expect(startRequirements({ ...ready, appPays: true })).toEqual([]);
		expect(startRequirements({ ...ready, appPays: true, backupConfig: { copies: 2 } })).toEqual(['Wallet für die Sicherungen']);
		expect(startRequirements({ ...ready, appPays: true, payer: wallet, backupConfig: { copies: 2 } })).toEqual([]);
	});
});

describe('resumeStart', () => {
	afterEach(() => vi.unstubAllGlobals());
	const master = new Uint8Array(32).fill(7);
	it('needs an interrupted start', async () => {
		await expect(resumeStart(master, {}, () => {})).rejects.toThrow('keinen unterbrochenen Start');
	});
	it('stops when Aleph no longer has the VM', async () => {
		vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ status: 'forgotten' })));
		const steps = [];
		const starting = { instanceHash: 'c'.repeat(64), crnHash: 'd'.repeat(64), payer: app, trustedExecution: {}, restoreEntry: null, at: 0 };
		await expect(resumeStart(master, { starting }, (p) => steps.push(p.step))).rejects.toThrow('gibt es bei Aleph nicht mehr (forgotten)');
		expect(steps).toEqual(['instance']);
	});
});
