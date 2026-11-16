// A node that refuses the VM (it says it cannot run SEV-SNP, though Aleph's
// list claims it can) costs no new image build: the start forgets that
// INSTANCE, notes the node and asks another one. Hashes are made up, except
// the public node hashes.
import { describe, expect, it, vi } from 'vitest';

const notify = vi.hoisted(() => ({ impl: async () => ({ status: 'confirmed' }) }));
vi.mock('./attest-wasm-load.js', () => ({ loadAttestWasm: async () => ({}) }));
vi.mock('./runtime-pin.js', () => ({ pinnedTrustedExecution: async () => ({ firmware: 'f' }) }));
vi.mock('./balances.js', () => ({ confidentialCreditsPerHour: () => 1, RESERVE_HOURS: 24, runningCreditsPerHour: async () => 0 }));
vi.mock('./vm.js', async (orig) => ({
	...(await orig()),
	instanceMessage: async () => ({ type: 'INSTANCE', item_hash: 'ab'.repeat(32) }),
	credits: async () => 1e9,
	estimateCreditsPerHour: async () => 1,
	sendInstance: async () => 'ab'.repeat(32),
	crnAddress: async () => 'https://node.example',
	notifyNode: (...a) => notify.impl(...a)
}));

const { NodeRefusedError, nodeRefusal, pickNode, startElsewhere, startPaperless } = await import('./lifecycle.js');

const LEVIATHAN_CRN11 = '6f3d9f424fa8d9362a0584097a02b864638451c7acad7badccf657850477039b';
const BUILDER_NODE = '01a3143b384ca43a3af338031b03ae86c0a4e139a24b848475d3ddb9bfbce8fa';
const A = 'a'.repeat(64);
const SEV_SNP_REFUSAL = "the node did not take the instance: CRN allocation notify returned 503: VmSetupError('this host does not support SEV-SNP')";

const node = (hash, fits = true) => ({ hash, fits, name: hash.slice(0, 4), score: 1, freeVcpus: 8, freeMemoryGiB: 32, freeDiskGiB: 500, place: null, owner: '' });

describe('nodeRefusal', () => {
	it('tells a node without SEV-SNP from one that refused the allocation, and from no answer', () => {
		expect(nodeRefusal(new Error(SEV_SNP_REFUSAL))).toBe('noSevSnp');
		expect(nodeRefusal('VmSetupError: this host does not support SEV-SNP')).toBe('noSevSnp');
		expect(nodeRefusal(new Error('the node did not take the instance: CRN allocation notify returned 500: boom'))).toBe('refused');
		expect(nodeRefusal(new Error('the node did not take the instance: no reason given'))).toBeNull();
		expect(nodeRefusal(new Error('Failed to fetch'))).toBeNull();
	});
});

describe('pickNode', () => {
	it('never picks the blocked node, prefers proven ones, skips avoided and full ones', async () => {
		const load = async () => [node(LEVIATHAN_CRN11), node('c'.repeat(64), false), node(A), node(BUILDER_NODE), node('d'.repeat(64))];
		expect(await pickNode({ load })).toBe(A);
		expect(await pickNode({ load, proven: new Set([BUILDER_NODE]) })).toBe(BUILDER_NODE);
		expect(await pickNode({ load, avoid: new Set([A, BUILDER_NODE]) })).toBe('d'.repeat(64));
	});

	it('says no node has room when only the blocked one would', async () => {
		await expect(pickNode({ load: async () => [node(LEVIATHAN_CRN11)] })).rejects.toThrow();
	});
});

describe('startPaperless on a node without SEV-SNP', () => {
	it('throws NodeRefusedError naming the node, the INSTANCE and the payer', async () => {
		notify.impl = async () => {
			throw new Error(SEV_SNP_REFUSAL);
		};
		const profile = { rootfsItemHash: 'r'.repeat(64), luksPassphrase: 'p', luksFor: 'r'.repeat(64), crnHash: LEVIATHAN_CRN11, role: 'test', network: 'calibration', appPays: true };
		const onRequested = vi.fn();
		const e = await startPaperless(new Uint8Array(32).fill(7), profile, () => {}, { onRequested }).catch((x) => x);
		expect(e).toBeInstanceOf(NodeRefusedError);
		expect(e.kind).toBe('noSevSnp');
		expect(e.crnHash).toBe(LEVIATHAN_CRN11);
		expect(e.instanceHash).toBe('ab'.repeat(32));
		expect(e.payer).toMatch(/^0x/);
		expect(onRequested).toHaveBeenCalledOnce();
	});

	it('passes any other failure of the notification on unchanged', async () => {
		notify.impl = async () => {
			throw new Error('the node did not take the instance: no reason given');
		};
		const profile = { rootfsItemHash: 'r'.repeat(64), luksPassphrase: 'p', luksFor: 'r'.repeat(64), crnHash: A, role: 'test', network: 'calibration', appPays: true };
		const e = await startPaperless(new Uint8Array(32).fill(7), profile, () => {}).catch((x) => x);
		expect(e).not.toBeInstanceOf(NodeRefusedError);
	});
});

describe('startElsewhere', () => {
	const refused = (crnHash) => new NodeRefusedError({ crnHash, instanceHash: 'ab'.repeat(32), payer: '0x1', kind: 'noSevSnp', reason: 'no SEV-SNP' });

	it('forgets and notes the refusing node, then starts on the next one picked', async () => {
		const picks = [LEVIATHAN_CRN11, A];
		const tried = [];
		const onRefused = vi.fn();
		const out = await startElsewhere({
			pick: async () => picks.shift(),
			start: async (crn) => {
				tried.push(crn);
				if (crn === LEVIATHAN_CRN11) throw refused(crn);
				return { crnHash: crn };
			},
			onRefused
		});
		expect(out).toEqual({ crnHash: A });
		expect(tried).toEqual([LEVIATHAN_CRN11, A]);
		expect(onRefused).toHaveBeenCalledOnce();
		expect(onRefused.mock.calls[0][0].crnHash).toBe(LEVIATHAN_CRN11);
	});

	it('gives up after the tries, with the last refusal', async () => {
		const start = vi.fn(async (crn) => {
			throw refused(crn);
		});
		await expect(startElsewhere({ pick: async () => A, start, onRefused: () => {}, tries: 2 })).rejects.toBeInstanceOf(NodeRefusedError);
		expect(start).toHaveBeenCalledTimes(2);
	});

	it('does not replace a node fixed in the setup', async () => {
		const pick = vi.fn();
		const onRefused = vi.fn();
		await expect(startElsewhere({ fixed: A, pick, start: async (crn) => { throw refused(crn); }, onRefused })).rejects.toBeInstanceOf(NodeRefusedError);
		expect(pick).not.toHaveBeenCalled();
		expect(onRefused).toHaveBeenCalledOnce();
	});

	it('passes other errors on without retrying', async () => {
		const pick = vi.fn(async () => A);
		await expect(startElsewhere({ pick, start: async () => { throw new Error('other'); }, onRefused: () => {} })).rejects.toThrow('other');
		expect(pick).toHaveBeenCalledOnce();
	});
});
