import { afterEach, describe, expect, it, vi } from 'vitest';
import { backupListing, vmPayer } from './profile.js';
import { refreshBackupSigner, resumeStart, startRequirements } from './lifecycle.js';

const app = '0x00000000000000000000000000000000000000A1';
const wallet = '0x00000000000000000000000000000000000000B2';
const ready = { rootfsItemHash: 'a'.repeat(64), luksPassphrase: 'x', crnHash: 'b'.repeat(64) };

describe('vmPayer', () => {
	it('is the wallet unless the app pays', () => {
		expect(vmPayer({ payer: wallet }, app)).toBe(wallet);
		expect(vmPayer({ payer: wallet, appPays: true }, app)).toBe(app);
		expect(vmPayer({ appPays: true }, app)).toBe(app);
		expect(vmPayer({}, app)).toBeUndefined();
		// Model A: Le Space's account for this customer, once known.
		expect(vmPayer({ payer: wallet, appPays: true, leSpacePays: true, vmOwner: '0x' + '5'.repeat(40) }, app)).toBe('0x' + '5'.repeat(40));
		expect(vmPayer({ leSpacePays: true }, app)).toBeNull();
	});
});

describe('backupListing', () => {
	const lePayer = '0x' + '0'.repeat(39) + '1';
	const signer = { payer: lePayer, signer: '0x' + '0'.repeat(39) + '2', tag: 'ab'.repeat(16), label: 'paperless-backup-test', network: 'calibration' };
	it('lists the wallet\'s data sets, or Le Space\'s payer\'s with this account\'s tag', () => {
		expect(backupListing({ payer: wallet })).toEqual({ owner: wallet });
		expect(backupListing({ payer: wallet, appPays: true })).toEqual({ owner: wallet });
		expect(backupListing({ payer: wallet, backupsByCredits: true, backupSigner: signer })).toEqual({ owner: lePayer, customer: signer.tag, label: 'paperless-backup-test' });
		expect(backupListing({ backupsByCredits: true })).toBeNull();
		expect(backupListing({})).toBeNull();
	});
	it('carries the service\'s client data set ids when it has them', () => {
		expect(backupListing({ backupsByCredits: true, backupSigner: signer }, { dataSets: ['7'] })).toEqual({ owner: lePayer, customer: signer.tag, label: 'paperless-backup-test', dataSetIds: ['7'] });
		expect(backupListing({ backupsByCredits: true, backupSigner: signer }, null)).not.toHaveProperty('dataSetIds');
		expect(backupListing({ payer: wallet }, { dataSets: ['7'] })).toEqual({ owner: wallet });
	});
	it('takes a wallet set as the backups\' owner first', () => {
		const owner = '0x' + '0'.repeat(39) + '3';
		expect(backupListing({ backupOwner: owner, backupsByCredits: true, backupSigner: signer })).toEqual({ owner });
	});
});

describe('startRequirements', () => {
	it('needs a wallet only to pay, or for backups when the app pays', () => {
		expect(startRequirements({ ...ready })).toEqual(['zahlendes Konto']);
		expect(startRequirements({ ...ready, payer: wallet })).toEqual([]);
		expect(startRequirements({ ...ready, appPays: true })).toEqual([]);
		expect(startRequirements({ ...ready, leSpacePays: true })).toEqual([]);
		expect(startRequirements({ ...ready, appPays: true, backupConfig: { copies: 2 } })).toEqual(['Wallet für die Sicherungen']);
		expect(startRequirements({ ...ready, appPays: true, payer: wallet, backupConfig: { copies: 2 } })).toEqual([]);
		// Backups paid through Le Space Credits: no wallet at all.
		expect(startRequirements({ ...ready, appPays: true, backupsByCredits: true, backupConfig: { copies: 2 }, backupSigner: { payer: '0x' + '0'.repeat(39) + '1', network: 'calibration' } })).toEqual([]);
		// …once the service has the VM's backup key, for this network.
		expect(startRequirements({ ...ready, appPays: true, backupsByCredits: true, backupConfig: { copies: 2 } })).toEqual(['Sicherungen über Le Space Credits freigeben']);
		expect(startRequirements({ ...ready, appPays: true, backupsByCredits: true, backupConfig: { copies: 2 }, backupSigner: { payer: '0x' + '0'.repeat(39) + '1', network: 'mainnet' } })).toEqual(['Sicherungen über Le Space Credits freigeben']);
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

describe('refreshBackupSigner', () => {
	const master = new Uint8Array(32).fill(7);
	const old = { payer: '0x' + '0'.repeat(39) + '1', signer: '0x' + '0'.repeat(39) + '2', tag: 'ab'.repeat(16), label: 'paperless-backup-test', network: 'calibration' };
	const recorder = () => {
		const saved = [];
		return { saved, update: async (_m, change) => { const next = change({ keep: 1 }); saved.push(next); return next; } };
	};
	it('keeps a new signer from the service in the profile', async () => {
		const r = recorder();
		const fresh = { ...old, signer: '0x' + '0'.repeat(39) + '3', fundedUntil: null };
		expect(await refreshBackupSigner(master, { backupsByCredits: true, backupSigner: old }, { authorize: async () => fresh, update: r.update })).toEqual({ ...old, signer: fresh.signer });
		expect(r.saved).toEqual([{ keep: 1, backupSigner: { ...old, signer: fresh.signer } }]);
	});
	it('writes nothing when nothing changed, and falls back to the recorded one without an answer', async () => {
		const r = recorder();
		expect(await refreshBackupSigner(master, { backupsByCredits: true, backupSigner: old }, { authorize: async () => ({ ...old, fundedUntil: null }), update: r.update })).toEqual(old);
		expect(await refreshBackupSigner(master, { backupsByCredits: true, backupSigner: old }, { authorize: async () => { throw new Error('offline'); }, update: r.update })).toBe(old);
		expect(r.saved).toEqual([]);
	});
	it('does nothing on the wallet path', async () => {
		const r = recorder();
		expect(await refreshBackupSigner(master, { payer: wallet }, { authorize: async () => { throw new Error('not called'); }, update: r.update })).toBeNull();
	});
});
