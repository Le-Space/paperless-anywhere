import { describe, expect, it } from 'vitest';
import { evidenceRows, launchesOf, tally, tcbLine } from './evidence.js';
import { evidenceTexts } from './evidence-i18n.js';
import { attestRunning, attestationOf } from './lifecycle.js';

const runtime = { name: 'snp-test', itemHash: 'a'.repeat(64), bundleSha256: 'b'.repeat(64), cmdlineTemplate: 'console=ttyS0 luks=1 owner={owner}' };
const tee = { mode: 'sev_snp', policy: 196608, runtime: 'snp-test', measurements: [{ platform: 'sev_snp', registers: { launch: '11'.repeat(48) }, vcpu_type: 'EPYC-v4' }, { platform: 'sev_snp', registers: { launch: '22'.repeat(48) } }] };
const running = { instanceHash: 'c'.repeat(64), crnHash: 'd'.repeat(64), host: 'vm.example', payer: '0x00000000000000000000000000000000000000bb', trustedExecution: tee, dataDisk: 'encrypted' };
const attestation = { measurement: '22'.repeat(48), policy: '0x30000', launchTcb: { fmc: null, bootloader: 4, tee: 0, snp: 22, microcode: 213 }, at: Date.UTC(2026, 0, 2, 3, 4, 5) };
const base = { runtime, alephApi: 'https://api.example', rootfsItemHash: 'e'.repeat(64) };
const row = (rows, id) => rows.find((r) => r.id === id);

describe('the evidence of a VM', () => {
	it('names every claim once, in a fixed order', () => {
		expect(evidenceRows({ ...base, running }).map((r) => r.id)).toEqual(['runtime', 'measurement', 'instance', 'node', 'attestation', 'relay', 'image', 'data', 'backups']);
	});

	it('calls the attestation checked only with a kept result whose measurement the app computed', () => {
		expect(row(evidenceRows({ ...base, running }), 'attestation')).toMatchObject({ mark: 'open', note: 'notKept', values: [] });
		const checked = row(evidenceRows({ ...base, running: { ...running, attestation } }), 'attestation');
		expect(checked.mark).toBe('app');
		expect(checked.values.map((v) => v.k)).toEqual(['reportMeasurement', 'policy', 'tcb', 'at']);
		expect(checked.values[3].v).toBe('2026-01-02T03:04:05.000Z');
		const other = row(evidenceRows({ ...base, running: { ...running, attestation: { ...attestation, measurement: '33'.repeat(48) } } }), 'attestation');
		expect(other).toMatchObject({ mark: 'open', note: 'mismatch' });
	});

	it('names the relay that carried the attestation, and never calls a relay confirmed', () => {
		const unknown = row(evidenceRows({ ...base, running: { ...running, attestation } }), 'relay');
		expect(unknown).toMatchObject({ mark: 'open', note: 'relayUnknown', values: [] });
		const leSpace = row(evidenceRows({ ...base, running: { ...running, attestation: { ...attestation, relay: { host: 'four-made-up-words.2n6.me', own: false } } } }), 'relay');
		expect(leSpace).toMatchObject({ mark: 'open', note: 'relayLeSpace', values: [{ k: 'relayHost', v: 'four-made-up-words.2n6.me', mono: true }] });
		const own = row(evidenceRows({ ...base, running: { ...running, attestation: { ...attestation, relay: { host: 'relay.example', own: true } } } }), 'relay');
		expect(own).toMatchObject({ mark: 'open', note: 'relayOwn' });
		// Without a kept attestation there is no relay to name either.
		expect(row(evidenceRows({ ...base, running }), 'relay')).toMatchObject({ mark: 'open', note: 'relayUnknown' });
		expect(leSpace.links.map((l) => l.k)).toEqual(['relayWs', 'relayP2p']);
	});

	it('never calls the image confirmed, and what the VM says about itself only reported', () => {
		const rows = evidenceRows({ ...base, running, lastGood: { at: '2026-01-02T03:04:05Z', copies: 2, pieceCid: 'bafkexample' }, backupsOn: true });
		expect(row(rows, 'image')).toMatchObject({ mark: 'open', note: 'notMeasured' });
		expect(row(rows, 'data')).toMatchObject({ mark: 'reported', note: 'sealed' });
		expect(row(rows, 'node').mark).toBe('reported');
		expect(row(rows, 'backups')).toMatchObject({ mark: 'reported', note: 'encrypted' });
		expect(row(evidenceRows({ ...base, running: { ...running, dataDisk: 'plain' } }), 'data')).toMatchObject({ mark: 'reported', note: 'plain' });
		expect(row(evidenceRows({ ...base, running: { ...running, dataDisk: 'unknown' } }), 'data')).toMatchObject({ mark: 'open', note: 'unknown' });
		expect(row(evidenceRows({ ...base, running }), 'backups')).toMatchObject({ mark: 'open', note: 'off' });
		expect(row(evidenceRows({ ...base, running, backupsOn: true }), 'backups')).toMatchObject({ mark: 'open', note: 'noneYet' });
	});

	it('links the messages on Aleph by their hashes, and builds no link from a value that is no hash', () => {
		const rows = evidenceRows({ ...base, running });
		expect(row(rows, 'instance').links).toEqual([{ k: 'message', href: `https://api.example/api/v0/messages/${'c'.repeat(64)}` }]);
		expect(row(rows, 'runtime').links[0].href).toBe(`https://api.example/api/v0/messages/${'a'.repeat(64)}`);
		expect(row(rows, 'image').links[0].href).toBe(`https://api.example/api/v0/messages/${'e'.repeat(64)}`);
		const odd = evidenceRows({ ...base, rootfsItemHash: 'x"><script>', running: { ...running, instanceHash: 'javascript:alert(1)' } });
		expect(row(odd, 'instance').links).toEqual([]);
		expect(row(odd, 'image').links.map((l) => l.k)).toEqual(['build']);
		for (const r of odd) for (const l of r.links) expect(l.href).toMatch(/^https:\/\//);
	});

	it('builds no link from made-up values, but keeps the real runtime', () => {
		const rows = evidenceRows({ ...base, running, links: false });
		expect(row(rows, 'instance').links).toEqual([]);
		expect(row(rows, 'measurement').links).toEqual([]);
		expect(row(rows, 'image').links.map((l) => l.k)).toEqual(['build']);
		expect(row(rows, 'runtime').links).toHaveLength(1);
	});

	it('counts the marks and reads measurements and firmware levels', () => {
		expect(tally(evidenceRows({ ...base, running: { ...running, attestation } }))).toEqual({ app: 4, reported: 2, open: 3 });
		expect(launchesOf(tee)).toEqual(['11'.repeat(48), '22'.repeat(48)]);
		expect(launchesOf(null)).toEqual([]);
		expect(tcbLine(attestation.launchTcb)).toBe('bootloader 4 · tee 0 · snp 22 · microcode 213');
		expect(row(evidenceRows({ ...base, running: { ...running, trustedExecution: {} } }), 'measurement')).toMatchObject({ mark: 'open', note: 'none' });
	});
});

describe('the texts of the evidence view', () => {
	const shape = (v) => (Array.isArray(v) ? v.map(shape) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v);
	it('have the same keys in German and English', () => {
		expect(shape(evidenceTexts.en)).toEqual(shape(evidenceTexts.de));
	});
	it('have a text for every row, value, note and link the rows can name', () => {
		const variants = [
			{ ...base, running },
			{ ...base, running: { ...running, attestation }, lastGood: { at: '2026-01-02T03:04:05Z', copies: 2, pieceCid: 'bafkexample' }, backupsOn: true },
			{ ...base, running: { ...running, attestation: { ...attestation, measurement: 'ff' }, dataDisk: 'plain', trustedExecution: {} }, backupsOn: true },
			{ ...base, running: { ...running, dataDisk: 'unknown' } },
			{ ...base, running: { ...running, attestation: { ...attestation, relay: { host: 'relay.example', own: true } } } },
			{ ...base, running: { ...running, attestation: { ...attestation, relay: { host: 'relay.example', own: false } } } }
		];
		for (const lang of /** @type {const} */ (['de', 'en'])) {
			const t = evidenceTexts[lang];
			for (const v of variants)
				for (const r of evidenceRows(v)) {
					expect(t.rows[r.id]?.t, r.id).toBeTruthy();
					expect(t.marks[r.mark]).toBeTruthy();
					if (r.note) expect(t.notes[r.note], r.note).toBeTruthy();
					for (const x of r.values) expect(t.values[x.k], x.k).toBeTruthy();
					for (const l of r.links) expect(t.links[l.k], l.k).toBeTruthy();
				}
		}
	});
});

describe('checking a running VM again', () => {
	const master = new Uint8Array(32);
	it('keeps what the fresh report says, for the VM that was checked, and closes the channel', async () => {
		let closed = 0;
		let saved = null;
		const attest = async () => ({ freshVerified: attestation, relay: { host: 'relay.example', own: false }, channel: { close: () => closed++ } });
		const update = async (_m, fn) => (saved = fn({ running, other: 1 }));
		const got = await attestRunning(master, { running }, { attest, update });
		expect(got).toMatchObject({ measurement: attestation.measurement, policy: '0x30000' });
		expect(saved.running.attestation.measurement).toBe(attestation.measurement);
		expect(saved.running.attestation.relay).toEqual({ host: 'relay.example', own: false });
		expect(saved.other).toBe(1);
		expect(closed).toBe(1);
		// Another VM runs by now: nothing is written onto it.
		const elsewhere = { running: { ...running, instanceHash: 'f'.repeat(64) } };
		await attestRunning(master, { running }, { attest, update: async (_m, fn) => (saved = fn(elsewhere)) });
		expect(saved).toBe(elsewhere);
	});
	it('records nothing when the attestation fails or no VM runs', async () => {
		let saved = false;
		const update = async () => (saved = true);
		await expect(attestRunning(master, { running }, { attest: async () => { throw new Error('measurement rejected'); }, update })).rejects.toThrow('measurement rejected');
		await expect(attestRunning(master, {}, { attest: async () => ({}), update })).rejects.toThrow();
		expect(saved).toBe(false);
		expect(attestationOf(null)).toBeNull();
		expect(attestationOf({ injected: [] })).toBeNull();
	});
});
