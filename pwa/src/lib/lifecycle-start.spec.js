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
