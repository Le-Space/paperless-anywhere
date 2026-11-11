import { describe, expect, it } from 'vitest';
import { checkManifest, pinnedTrustedExecution, RUNTIME, RuntimeMismatchError } from './runtime-pin.js';

const manifest = (over = {}) => ({
	format: 'aleph-instance-runtime',
	platform: 'sev_snp',
	boot: { cmdline_template: RUNTIME.cmdlineTemplate, cpu_models: ['EPYC-v4'], ...over.boot },
	bundle: { ref: 'ab'.repeat(32), sha256: RUNTIME.bundleSha256, members: { ...RUNTIME.members }, ...over.bundle }
});

const wasm = {
	instanceCmdline: (template, owner) => template.replace('{owner}', owner),
	launchMeasurements: (_ovmf, _kernel, _initrd, cmdline) => [{ vcpuType: 'EPYC-v4', launch: `digest of ${cmdline}` }]
};

describe('the pinned runtime', () => {
	it('accepts the manifest it knows', () => {
		expect(() => checkManifest(manifest())).not.toThrow();
	});

	it('refuses another bundle, boot line or member', () => {
		expect(() => checkManifest(manifest({ bundle: { sha256: '00'.repeat(32) } }))).toThrow(RuntimeMismatchError);
		expect(() => checkManifest(manifest({ boot: { cmdline_template: 'console=ttyS0 owner={owner} init=/bin/sh' } }))).toThrow(RuntimeMismatchError);
		expect(() => checkManifest(manifest({ bundle: { members: { ...RUNTIME.members, initrd: 'image/other' } } }))).toThrow(RuntimeMismatchError);
		expect(() => checkManifest(null)).toThrow(RuntimeMismatchError);
	});

	it('asks for its own item hash, not for the network default', async () => {
		const asked = [];
		const load = async ({ itemHash }) => (asked.push(itemHash), { itemHash, manifest: manifest(), ovmf: new Uint8Array(), kernel: new Uint8Array(), initrd: new Uint8Array() });
		const tee = await pinnedTrustedExecution({ wasm, owner: '0xabc', vcpus: 2, load });
		expect(asked).toEqual([RUNTIME.itemHash]);
		expect(tee.runtime).toBe(RUNTIME.itemHash);
		expect(tee.measurements[0].registers.launch).toBe('digest of console=ttyS0 luks=1 owner=0xabc');
	});

	it('computes no measurements for a runtime it does not know', async () => {
		const load = async ({ itemHash }) => ({ itemHash, manifest: manifest({ bundle: { sha256: 'ff'.repeat(32) } }), ovmf: new Uint8Array(), kernel: new Uint8Array(), initrd: new Uint8Array() });
		await expect(pinnedTrustedExecution({ wasm, owner: '0xabc', vcpus: 2, load })).rejects.toThrow(RuntimeMismatchError);
	});
});
