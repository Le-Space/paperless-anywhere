import { afterEach, describe, expect, it, vi } from 'vitest';
import { backupPayer, vmPayer } from './profile.js';
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

describe('backupPayer', () => {
	it('is the wallet, or the vault\'s own payer when Le Space Credits pay the backups', () => {
		const own = '0x' + '3'.repeat(40);
		expect(backupPayer({ payer: wallet }, own)).toBe(wallet);
		expect(backupPayer({ payer: wallet, appPays: true }, own)).toBe(wallet);
		expect(backupPayer({ payer: wallet, backupsByCredits: true }, own)).toBe(own);
		expect(backupPayer({ backupsByCredits: true }, own)).toBe(own);
	});
});

describe('startRequirements', () => {
	it('needs a wallet only to pay, or for backups when the app pays', () => {
		expect(startRequirements({ ...ready })).toEqual(['zahlendes Konto']);
		expect(startRequirements({ ...ready, payer: wallet })).toEqual([]);
		expect(startRequirements({ ...ready, appPays: true })).toEqual([]);
		expect(startRequirements({ ...ready, appPays: true, backupConfig: { copies: 2 } })).toEqual(['Wallet für die Sicherungen']);
		expect(startRequirements({ ...ready, appPays: true, payer: wallet, backupConfig: { copies: 2 } })).toEqual([]);
		// Backups paid through Le Space Credits: no wallet at all.
		expect(startRequirements({ ...ready, appPays: true, backupsByCredits: true, backupConfig: { copies: 2 } })).toEqual([]);
	});
	it('runs a primary on mainnet only', () => {
		expect(startRequirements({ ...ready, payer: wallet, role: 'primary', network: 'calibration' })).toEqual(['Netz Mainnet für die Rolle „Produktiv“']);
		expect(startRequirements({ ...ready, payer: wallet, role: 'primary', network: 'mainnet' })).toEqual([]);
		expect(startRequirements({ ...ready, payer: wallet, network: 'mainnet', backupConfig: { copies: 2 } })).toEqual(['Rolle „Produktiv“ für Sicherungen auf Mainnet (oder Sicherungen aus)']);
		expect(startRequirements({ ...ready, payer: wallet, role: 'primary', network: 'mainnet', backupConfig: { copies: 2 } })).toEqual([]);
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

describe('trialProfile', () => {
	it('restores as a test: no backups, no fixed address, not the running VM', async () => {
		const { trialProfile } = await import('./lifecycle.js');
		const p = trialProfile({ role: 'primary', network: 'mainnet', dnsToken: 't', backupConfig: { copies: 3 }, running: { host: 'x' }, trial: {}, ageIdentity: 'AGE-SECRET-KEY-1X', rootfsItemHash: 'h' }, { pieceCid: 'bafk' });
		expect(p).toEqual({ role: 'test', network: 'mainnet', ageIdentity: 'AGE-SECRET-KEY-1X', rootfsItemHash: 'h', restoreEntry: { pieceCid: 'bafk' } });
	});
});
