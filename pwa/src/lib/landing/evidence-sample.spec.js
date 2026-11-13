import { describe, expect, it } from 'vitest';
import { RUNTIME } from '../runtime-pin.js';
import { SAMPLE, sampleRows } from './evidence-sample.js';
import { RUNTIME_SAMPLE } from './trust.js';

describe('the sample of the evidence view on the landing page', () => {
	const rows = sampleRows();
	const row = (id) => rows.find((r) => r.id === id);

	it('names the real, public runtime and nothing else that is real', () => {
		expect(RUNTIME_SAMPLE).toEqual({ name: RUNTIME.name, itemHash: RUNTIME.itemHash, bundleSha256: RUNTIME.bundleSha256, cmdlineTemplate: RUNTIME.cmdlineTemplate });
		const made = rows.filter((r) => r.id !== 'runtime').flatMap((r) => r.values.map((v) => v.v));
		// No value could be a hash, an address or a content address of anything.
		for (const v of made) {
			expect(v, v).not.toMatch(/[0-9a-f]{32,}/i);
			expect(v, v).not.toMatch(/^0x[0-9a-fA-F]{40}$/);
			expect(v, v).not.toMatch(/^baf[a-z2-7]{20,}/);
		}
		for (const v of [SAMPLE.running.instanceHash, SAMPLE.running.crnHash, SAMPLE.running.payer, SAMPLE.rootfsItemHash, SAMPLE.lastGood.pieceCid, SAMPLE.running.attestation.measurement]) expect(v.toLowerCase()).toContain('example');
		expect(SAMPLE.running.host).toMatch(/\.example$/);
	});

	it('builds no link from a made-up value', () => {
		const aleph = rows.flatMap((r) => r.links.map((l) => ({ id: r.id, ...l }))).filter((l) => l.href.includes('aleph'));
		expect(aleph.map((l) => l.id)).toEqual(['runtime']);
		expect(row('instance').links).toEqual([]);
		expect(row('measurement').links).toEqual([]);
	});

	it('shows the same honesty as the real view: the image open, the VM’s word only reported', () => {
		expect(row('attestation').mark).toBe('app');
		expect(row('image')).toMatchObject({ mark: 'open', note: 'notMeasured' });
		expect(row('data').mark).toBe('reported');
		expect(row('backups').mark).toBe('reported');
	});
});
