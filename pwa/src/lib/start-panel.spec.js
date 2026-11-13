import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { currentRow, startPanel } from './start-panel.js';
import { panelTexts } from './evidence-i18n.js';
import StartPanel from './StartPanel.svelte';

const lights = (rows) => Object.fromEntries(rows.flatMap((r) => r.lights.map((l) => [l.id, l.state])));
const rowStates = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.state]));
const attestation = { measurement: 'ab'.repeat(48) };
const ready = { phase: 'ready', paperless: true, dataDisk: { status: 'encrypted' }, start: { timeline: { unlocked: 1, containers: 60, cert: 90, paperless: 120 } } };

describe('the start panel', () => {
	it('is dark before anything happened, and lights nothing ahead of its step', () => {
		expect(Object.values(lights(startPanel({ step: '' }))).every((s) => s === 'off')).toBe(true);
		const measuring = startPanel({ step: 'measure' });
		expect(lights(measuring)).toMatchObject({ runtime: 'run', measurement: 'run', signed: 'off', report: 'off', paperless: 'off' });
		expect(currentRow(measuring).id).toBe('measure');
		const placing = lights(startPanel({ step: 'instance' }));
		expect(placing).toMatchObject({ runtime: 'app', measurement: 'app', signed: 'run', notified: 'run', port: 'off' });
	});

	it('marks what the app did itself as checked and what Aleph says as reported', () => {
		const l = lights(startPanel({ step: 'unlock', libPhase: 'attest' }));
		expect(l).toMatchObject({ signed: 'app', notified: 'reported', port: 'reported', address: 'reported', report: 'run', binding: 'run', handed: 'off', stored: 'off' });
	});

	it('lights the attestation only once the report is verified, and the hand-over only once it returned', () => {
		expect(lights(startPanel({ step: 'unlock', libPhase: 'wait' }))).toMatchObject({ report: 'run', handed: 'off' });
		expect(lights(startPanel({ step: 'unlock', libPhase: 'unlock' }))).toMatchObject({ report: 'app', binding: 'app', handed: 'run', stored: 'run' });
		expect(lights(startPanel({ step: 'unlock', libPhase: 'unlock', unlock: { injected: ['passphrase'], attestation } }))).toMatchObject({ report: 'app', handed: 'app', stored: 'reported' });
		// The VM named nothing it stored: that light stays dark.
		expect(lights(startPanel({ step: 'ready', unlock: { injected: [], attestation } }))).toMatchObject({ handed: 'app', stored: 'off' });
	});

	it('never lights the hand-over after a failed attestation', () => {
		const rows = startPanel({ step: 'unlock', libPhase: 'attest', failed: true });
		expect(lights(rows)).toMatchObject({ report: 'failed', binding: 'failed', handed: 'off', stored: 'off', paperless: 'off' });
		expect(rowStates(rows)).toMatchObject({ attestation: 'failed', unlock: 'off', ready: 'off' });
		expect(currentRow(rows).id).toBe('attestation');
	});

	it('says of a resumed start that found the VM unlocked: not checked in this session', () => {
		const rows = startPanel({ step: 'ready', unlock: { already: true }, status: ready });
		expect(lights(rows)).toMatchObject({ report: 'skipped', binding: 'skipped', handed: 'skipped', stored: 'skipped', paperless: 'reported' });
		expect(rowStates(rows)).toMatchObject({ attestation: 'skipped', unlock: 'skipped' });
		// Also when the start is over, and when the unlock's result is unknown.
		expect(lights(startPanel({ step: 'ready', unlock: { already: true }, status: ready, finished: true })).report).toBe('skipped');
		expect(lights(startPanel({ step: 'ready' })).report).toBe('skipped');
	});

	it('lights the last row from the VM’s status page only, each as reported', () => {
		expect(lights(startPanel({ step: 'ready', unlock: { injected: ['x'], attestation } }))).toMatchObject({ dataDisk: 'run', containers: 'run', cert: 'run', paperless: 'run' });
		const half = { phase: 'starting', dataDisk: { status: 'encrypted' }, start: { timeline: { containers: 60 } } };
		expect(lights(startPanel({ step: 'ready', status: half }))).toMatchObject({ dataDisk: 'reported', containers: 'reported', cert: 'run', paperless: 'run' });
		const done = startPanel({ step: 'ready', unlock: { injected: ['x'], attestation }, status: ready, finished: true });
		expect(lights(done)).toMatchObject({ dataDisk: 'reported', containers: 'reported', cert: 'reported', paperless: 'reported' });
		expect(Object.values(rowStates(done)).every((s) => s === 'done')).toBe(true);
		expect(currentRow(done)).toBeNull();
		expect(lights(startPanel({ step: 'ready', status: { phase: 'data-disk-failed', dataDisk: { status: 'failed' } }, failed: true })).dataDisk).toBe('failed');
		// An older image says nothing about its data area: that light stays dark, the row is still done.
		const old = startPanel({ step: 'ready', unlock: { injected: ['x'], attestation }, status: { phase: 'ready', paperless: true }, finished: true });
		expect(lights(old)).toMatchObject({ dataDisk: 'off', paperless: 'reported' });
		expect(rowStates(old).ready).toBe('done');
	});

	it('has a restore row only for a start that restores', () => {
		expect(startPanel({ step: 'ready' }).map((r) => r.id)).not.toContain('restore');
		const ids = startPanel({ step: 'ready', restore: true }).map((r) => r.id);
		expect(ids).toEqual(['measure', 'instance', 'network', 'attestation', 'unlock', 'restore', 'ready']);
		expect(lights(startPanel({ step: 'ready', restore: true, status: { restore: { status: 'running' } } })).restored).toBe('run');
		expect(lights(startPanel({ step: 'ready', restore: true, status: { restore: { status: 'done' } } })).restored).toBe('reported');
		expect(lights(startPanel({ step: 'ready', restore: true, status: { restore: { status: 'failed' } } })).restored).toBe('failed');
	});
});

describe('the start panel’s texts', () => {
	const shape = (v) => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v);
	it('have the same keys in German and English, and one for every row, light and state', () => {
		expect(shape(panelTexts.en)).toEqual(shape(panelTexts.de));
		const rows = startPanel({ step: 'ready', restore: true });
		for (const t of Object.values(panelTexts)) {
			for (const r of rows) {
				expect(t.rows[r.id], r.id).toBeTruthy();
				for (const l of r.lights) expect(t.lights[l.id], l.id).toBeTruthy();
			}
			for (const s of ['off', 'run', 'app', 'reported', 'skipped', 'failed']) expect(t.states[s]).toBeTruthy();
			for (const s of ['off', 'run', 'done', 'skipped', 'failed']) expect(t.rowStates[s]).toBeTruthy();
		}
	});

	it('are all in the page as words: a list, each fact with its state, one polite line for the row under way', () => {
		const rows = startPanel({ step: 'unlock', libPhase: 'attest' });
		const { body } = render(StartPanel, { props: { rows, t: panelTexts.de } });
		expect(body).toContain('<ol');
		expect(body).toContain('Bericht von AMD signiert, Messwert und Policy wie berechnet');
		expect(body).toContain('(läuft)');
		expect(body).toContain('(von der App geprüft)');
		expect(body).toMatch(/role="status"[^>]*aria-live="polite"[^>]*>Attestierung: läuft</);
		// The lights themselves are hidden from a screen reader.
		expect(body).toMatch(/class="leds[^"]*" aria-hidden="true"/);
		const skipped = render(StartPanel, { props: { rows: startPanel({ step: 'ready', unlock: { already: true } }), t: panelTexts.de } }).body;
		expect(skipped).toContain('in dieser Sitzung nicht geprüft');
	});
});
