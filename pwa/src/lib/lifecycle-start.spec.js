// A start whose INSTANCE got no answer is kept as an interrupted start, so
// "Noch einmal" carries on with it instead of asking Aleph for a second VM.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const send = vi.hoisted(() => ({ impl: async () => 'x' }));
vi.mock('./attest-wasm-load.js', () => ({ loadAttestWasm: async () => ({}) }));
vi.mock('./runtime-pin.js', () => ({
	pinnedTrustedExecution: async () => ({ firmware: 'f' })
}));
vi.mock('./balances.js', () => ({
	confidentialCreditsPerHour: () => 1,
	RESERVE_HOURS: 24,
	runningCreditsPerHour: async () => 0
}));
vi.mock('./vm.js', async (orig) => ({
	...(await orig()),
	instanceMessage: async () => ({
		type: 'INSTANCE',
		item_hash: 'ab'.repeat(32)
	}),
	credits: async () => 1e9,
	estimateCreditsPerHour: async () => 1,
	sendInstance: (...a) => send.impl(...a),
	crnAddress: async () => {
		throw new Error('stop here');
	}
}));

const { startPaperless } = await import('./lifecycle.js');
const master = new Uint8Array(32).fill(7);
const profile = {
	rootfsItemHash: 'r'.repeat(64),
	luksPassphrase: 'p',
	luksFor: 'r'.repeat(64),
	crnHash: 'c'.repeat(64),
	role: 'test',
	network: 'calibration',
	appPays: true
};

describe('startPaperless and a broken connection', () => {
	beforeEach(() => (send.impl = async () => 'x'));

	it('keeps the VM as interrupted when Aleph gave no answer', async () => {
		send.impl = async () => {
			throw new Error('Aleph did not process the INSTANCE within 15 minutes');
		};
		const onRequested = vi.fn();
		await expect(startPaperless(master, profile, () => {}, { onRequested })).rejects.toThrow('15 minutes');
		expect(onRequested).toHaveBeenCalledWith(expect.objectContaining({ instanceHash: 'ab'.repeat(32) }));
	});
	it('keeps nothing when Aleph refused the VM', async () => {
		send.impl = async () => {
			throw Object.assign(new Error('Aleph refused the INSTANCE (422): {}'), {
				refused: true
			});
		};
		const onRequested = vi.fn();
		await expect(startPaperless(master, profile, () => {}, { onRequested })).rejects.toThrow('refused');
		expect(onRequested).not.toHaveBeenCalled();
	});
	it('keeps the VM once Aleph took it', async () => {
		send.impl = async () => 'ab'.repeat(32);
		const onRequested = vi.fn();
		await expect(startPaperless(master, profile, () => {}, { onRequested })).rejects.toThrow('stop here');
		expect(onRequested).toHaveBeenCalledTimes(1);
	});
});

describe('resumeStart and a start Aleph no longer has', () => {
	const hash = 'cd'.repeat(32);
	const image = 'ef'.repeat(32);
	const starting = { instanceHash: hash, crnHash: 'c'.repeat(64), payer: '0x' + '1'.repeat(40), trustedExecution: {}, restoreEntry: null, at: 0 };
	const answer = (status, body) => vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(body), { status }));

	it('a rejected INSTANCE is a StartGoneError naming the missing image', async () => {
		const { resumeStart, StartGoneError } = await import('./lifecycle.js');
		const f = answer(200, { status: 'rejected', error_code: 301, details: { errors: [image] } });
		const e = await resumeStart(master, { ...profile, starting }, () => {}).catch((x) => x);
		f.mockRestore();
		expect(e).toBeInstanceOf(StartGoneError);
		expect(e.missing).toEqual([image]);
		expect(e.message).toContain('abgelehnt');
		expect(e.message).toContain(image.slice(0, 12));
	});
	it('a forgotten INSTANCE is gone too', async () => {
		const { resumeStart, StartGoneError } = await import('./lifecycle.js');
		const f = answer(200, { status: 'forgotten' });
		const e = await resumeStart(master, { ...profile, starting }, () => {}).catch((x) => x);
		f.mockRestore();
		expect(e).toBeInstanceOf(StartGoneError);
	});
	it('one Aleph never got is gone once the wait is over', async () => {
		const { resumeStart, StartGoneError } = await import('./lifecycle.js');
		const f = answer(404, {});
		const e = await resumeStart(master, { ...profile, starting }, () => {}, { lookUpTries: 2, lookUpPauseMs: 1 }).catch((x) => x);
		f.mockRestore();
		expect(e).toBeInstanceOf(StartGoneError);
	});
});

describe('a start that restores, when no copy delivers', () => {
	it('asks for no VM and says to try again later', async () => {
		const { ownImagePatch } = await import('./own-image-check.js');
		const { imagePassphrase } = await import('./keys/derive.js');
		let sent = false;
		send.impl = async () => {
			sent = true;
		};
		const plain = 'ef'.repeat(32);
		const own = { ...profile, luksPassphrase: imagePassphrase(master, plain), ownImage: { plainSha256: plain, rootfsItemHash: profile.rootfsItemHash }, restoreEntry: { pieceCid: 'x', copies: [{ retrievalUrl: 'https://a.example/piece/x' }, { retrievalUrl: 'https://b.example/piece/x' }] } };
		expect(ownImagePatch(master, own)).toBeNull();
		const e = await startPaperless(master, own, () => {}, { reach: async () => ({ answering: 0, total: 2 }) }).catch((x) => x);
		expect(e.message).toMatch(/keine der 2 Kopien/);
		expect(e.retryable).toBe(true);
		expect(sent).toBe(false);
	});
});


describe('handing backup places to the running VM', () => {
	it('sends the config and the session key to a VM on the own image, and refuses others', async () => {
		const { pushBackupPlaces } = await import('./lifecycle.js');
		const { imagePassphrase } = await import('./keys/derive.js');
		const plain = 'ef'.repeat(32);
		const base = { ...profile, running: { instanceHash: 'c'.repeat(64) }, backupConfig: { network: 'calibration', copies: 2, providerIds: [43, 38], regions: [], datasetMetadata: { app: 'x' }, keepWeeks: 1, ageRecipient: 'age1' + 'q'.repeat(58) }, payer: '0x' + '1'.repeat(40) };
		const own = { ...base, luksPassphrase: imagePassphrase(master, plain), ownImage: { plainSha256: plain, rootfsItemHash: base.rootfsItemHash } };
		let got = null;
		const names = await pushBackupPlaces(master, own, { send: async (_m, _p, secrets) => void (got = secrets) });
		expect(names).toEqual(expect.arrayContaining(['backup_config', 'backup_session_key']));
		expect(JSON.parse(got.backup_config).providerIds).toEqual([43, 38]);
		// Not paid by a package: no end for the VM.
		expect(got.period_end).toBe('0');
		await expect(pushBackupPlaces(master, base, { send: async () => {} })).rejects.toThrow(/eigenen Image/);
		// A region goes as named providers, as at the start.
		const region = { ...own, backupConfig: { ...own.backupConfig, copies: 3, providerIds: [], regions: ['EUROPE'] } };
		await pushBackupPlaces(master, region, { send: async (_m, _p, secrets) => void (got = secrets), place: async (_n, c) => ({ ...c, copies: 3, providerIds: [43, 1, 38] }) });
		expect(JSON.parse(got.backup_config)).toMatchObject({ copies: 3, providerIds: [43, 1, 38], regions: ['EUROPE'] });
	});
});

describe('the secrets of a start fit what the guest takes', () => {
	it('the largest start (fixed address, backups through Credits, a restore of an unmarked backup, an end, debug keys) fits after the optional ones go', async () => {
		const { fitSecrets, MAX_GUEST_SECRETS } = await import('./lifecycle.js');
		const largest = Object.fromEntries(
			[
				'dns_cloudflare_token', 'https_ipv4', 'https_port',
				'https_hostname', 'paperless_role', 'paperless_admin_password', 'paperless_db_password', 'paperless_secret_key', 'status_token',
				'backup_mark_key', 'backup_config', 'backup_key',
				'restore_ledger_entry', 'age_identity', 'restore_unmarked',
				'period_end', 'authorized_keys'
			].map((k) => [k, 'x'])
		);
		const fit = fitSecrets(largest);
		expect(Object.keys(fit).length).toBeLessThanOrEqual(MAX_GUEST_SECRETS);
		// What a start needs stays; the end goes first.
		for (const k of ['dns_cloudflare_token', 'backup_config', 'backup_key', 'restore_ledger_entry', 'age_identity', 'restore_unmarked', 'backup_mark_key']) expect(fit).toHaveProperty(k);
		expect(fit).not.toHaveProperty('period_end');
	});
	it('says so plainly instead of the guest refusing', async () => {
		const { fitSecrets } = await import('./lifecycle.js');
		const tooMany = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`s${i}`, 'x']));
		expect(() => fitSecrets(tooMany)).toThrow(/höchstens 16/);
	});
	it('a start no longer sends the dedup key, nor an end that renews', async () => {
		const src = (await import('node:fs')).readFileSync(new URL('./lifecycle.js', import.meta.url), 'utf8');
		expect(src).not.toMatch(/secrets\.backup_dedup_key/);
		expect(src).toMatch(/periodEnd !== '0'/);
	});
});

describe('an empty start while backups exist', () => {
	it('sends no backup secrets unless the person begins anew, and the card asks', async () => {
		const { readFileSync } = await import('node:fs');
		const life = readFileSync(new URL('./lifecycle.js', import.meta.url), 'utf8');
		expect(life).toMatch(/if \(profile\.backupConfig && own && !profile\.holdBackups\) \{/);
		const card = readFileSync(new URL('./lifecycle-card.svelte.js', import.meta.url), 'utf8');
		expect(card).toMatch(/const holdBackups = !restore && \(backups\?\.length \?\? 0\) > 0 && !freshConfirmed;/);
		expect(card).toMatch(/restoreEntry: restore, holdBackups/);
		const view = readFileSync(new URL('./Lifecycle.svelte', import.meta.url), 'utf8');
		expect(view).toMatch(/data-testid="empty-fresh-confirm"/);
		expect(view).toMatch(/data-testid="tiny-newest"/);
	});
});
