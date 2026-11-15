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
