import { describe, expect, it } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { recoverMessageAddress } from 'viem';
import { instanceMessage, sha256Hex, signAsDelegate } from './vm.js';
import { createUnsignedForgetMessage } from '@le-space/core';

const app = privateKeyToAccount(generatePrivateKey());
const payer = privateKeyToAccount(generatePrivateKey()).address;
const signed = (m) => recoverMessageAddress({ message: [m.chain, m.sender, m.type, m.item_hash].join('\n'), signature: m.signature });

describe('delegated messages', () => {
	it('an INSTANCE is owned and paid by the payer, signed by the app', async () => {
		const tee = { mode: 'sev_snp', policy: 196608, runtime: '1'.repeat(64), measurements: [{ platform: 'sev_snp', registers: { launch: 'a'.repeat(96) }, vcpu_type: 'EPYC-Genoa' }] };
		const m = await instanceMessage({ app, payer, rootfsItemHash: 'b'.repeat(64), crnHash: 'c'.repeat(64), trustedExecution: tee, name: 'paperless' });
		const content = JSON.parse(m.item_content);
		expect(m.type).toBe('INSTANCE');
		expect(m.sender).toBe(app.address);
		expect(content.address).toBe(payer);
		expect(m.item_hash).toBe(await sha256Hex(m.item_content));
		expect(await signed(m)).toBe(app.address);
		expect(content.environment.trusted_execution.measurements[0].registers.launch).toBe('a'.repeat(96));
	});
	it('a FORGET on behalf of the payer keeps the payer as address', async () => {
		const unsigned = await createUnsignedForgetMessage({ sender: payer, hashes: ['d'.repeat(64)], reason: 'stop', hasher: sha256Hex });
		const m = await signAsDelegate(unsigned, app);
		expect(m.sender).toBe(app.address);
		expect(JSON.parse(m.item_content).address).toBe(payer);
		expect(await signed(m)).toBe(app.address);
	});
});
