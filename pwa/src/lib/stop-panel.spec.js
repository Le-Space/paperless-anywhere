import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { backupFacts, stopPanel } from './stop-panel.js';
import { currentRow } from './start-panel.js';
import { stopEvidenceRows } from './evidence.js';
import { evidenceTexts, panelTexts } from './evidence-i18n.js';
import StartPanel from './StartPanel.svelte';

const lights = (rows) => Object.fromEntries(rows.flatMap((r) => r.lights.map((l) => [l.id, l.state])));
const rowStates = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.state]));
// Made up: no real piece CID, data set or message.
const CID = 'bafkzcibmadeuppiece';
const T = '2026-01-02T03:04:05Z';
const stopping = (backup, extra = {}) => ({ phase: 'stopping', paperless: false, stop: { status: 'running', request: 'r1' }, backup, ...extra });
const copy = (providerId, dataSetId) => ({ providerId: String(providerId), dataSetId: String(dataSetId), pieceId: '7', location: 'DE', retrievalUrl: `https://sp${providerId}.example/piece/${CID}` });
const entry = (copies, want = 2, more = {}) => ({ name: 'made-up', date: '2026-01-02T03:10:00Z', pieceCid: CID, size: 52_000_000, requestedCopies: want, complete: copies.length >= want, copies, ...more });
const stopped = (copies, want = 2, more = {}) => ({ phase: 'stopped', paperless: false, stop: { status: 'ready', request: 'r1', backup: { status: 'done', backup: entry(copies, want, more), seconds: 300 } } });

describe('the backup tool’s lines', () => {
	it('reads the export, the upload and the piece, and nothing else', () => {
		const f = backupFacts([
			`${T} exporting Paperless …`,
			`${T} export: 42 files, no duplicate names`,
			`${T} uploading 52000000 bytes to providers 2, 5 (primary 2) …`,
			`${T} upload with primary 2 failed: made up`,
			`${T} piece ${CID}: 1/2 copies (INCOMPLETE)`,
			'something else'
		]);
		expect(f).toMatchObject({ exporting: true, files: 42, bytes: 52_000_000, providers: [2, 5], primary: 2, refused: [2], pieceCid: CID, copies: 1, requested: 2 });
		expect(backupFacts([`${T} part 2/3: 1000 bytes to provider 5 …`, `${T} 3 parts, first piece ${CID}: 2/2 copies`])).toMatchObject({ part: 2, parts: 3, pieceCid: CID, copies: 2 });
	});
});

describe('the stop panel', () => {
	it('lights nothing before the request went out, then only what the VM said', () => {
		const before = stopPanel({ kind: 'stop', busy: true });
		expect(Object.values(lights(before)).every((s) => s === 'off' || s === 'run')).toBe(true);
		expect(currentRow(before).id).toBe('request');
		const sent = lights(stopPanel({ kind: 'stop', sent: true, busy: true }));
		expect(sent).toMatchObject({ sent: 'app', taken: 'run', paused: 'off', exported: 'off', sealed: 'off' });
		const taken = stopPanel({ kind: 'stop', sent: true, status: stopping({ status: 'running', log: [`${T} exporting Paperless …`] }), busy: true });
		expect(lights(taken)).toMatchObject({ taken: 'reported', paused: 'reported', exported: 'run', sealed: 'off' });
		expect(currentRow(taken).id).toBe('export');
	});

	it('names the archive, its size and parts, and each copy, from the log lines', () => {
		const lines = [`${T} export: 42 files, no duplicate names`, `${T} uploading 52000000 bytes to providers 2, 5 (primary 2) …`, `${T} part 1/2: 1000 bytes to provider 2 …`];
		const rows = stopPanel({ kind: 'stop', sent: true, status: stopping({ status: 'running' }), lines, busy: true });
		const by = Object.fromEntries(rows.flatMap((r) => r.lights.map((l) => [l.id, l])));
		expect(by.exported).toMatchObject({ state: 'reported', key: 'exportedFiles', args: [42] });
		expect(by.sealed).toMatchObject({ state: 'reported', key: 'sealedParts', args: [52_000_000, 2] });
		// The copies run while the upload runs: no light is lit by a timer.
		expect(by['copy-2']).toMatchObject({ state: 'run', key: 'copyTo', args: [2] });
		expect(by['copy-5'].state).toBe('run');
		expect(lights(rows)).toMatchObject({ pieceCid: 'off', confirmed: 'off', node: 'off', listed: 'off' });
	});

	it('lights each copy with its data set once the VM reports it, and the erase from what answered', () => {
		const status = stopped([copy(2, 11), copy(5, 12)]);
		const mid = stopPanel({ kind: 'stop', sent: true, status, busy: true });
		const by = Object.fromEntries(mid.flatMap((r) => r.lights.map((l) => [l.id, l])));
		expect(by['copy-2']).toMatchObject({ state: 'reported', key: 'copyAt', args: [2, '11', 'DE'] });
		expect(by.pieceCid).toMatchObject({ state: 'reported', args: [CID] });
		expect(by.confirmed).toMatchObject({ state: 'reported', args: [2, 2] });
		expect(lights(mid)).toMatchObject({ node: 'run', forgot: 'run', listed: 'off' });
		const done = stopPanel({ kind: 'stop', sent: true, status, erase: { node: 'erased', forgot: 'f'.repeat(64), revoke: 'skipped' }, listed: true, finished: true });
		expect(lights(done)).toMatchObject({ node: 'reported', forgot: 'app', listed: 'app' });
		// No revoke when the key was not this VM's last use.
		expect(lights(done).revoke).toBeUndefined();
		expect(Object.values(rowStates(done)).every((s) => s === 'done')).toBe(true);
		expect(currentRow(done)).toBeNull();
	});

	it('lights the header check green only when the app opened the header itself', () => {
		const status = stopped([copy(2, 11)], 1);
		const at = (header) => Object.fromEntries(stopPanel({ kind: 'stop', sent: true, status, erase: { node: 'erased', forgot: 'f'.repeat(64) }, listed: true, header, finished: true }).flatMap((r) => r.lights.map((l) => [l.id, l])));
		expect(at(null).header).toBeUndefined();
		expect(at('checking').header.state).toBe('run');
		expect(at('opens').header).toMatchObject({ state: 'app' });
		expect(at('refused').header).toMatchObject({ state: 'failed', key: 'headerRefused' });
		expect(at('unreachable').header).toMatchObject({ state: 'skipped', key: 'headerUnreachable' });
		for (const lang of ['de', 'en']) for (const k of ['header', 'headerRefused', 'headerUnreachable']) expect(panelTexts[lang].stop.lights[k]).toBeTruthy();
	});

	it('says a node that did not answer, and a revoke left for later', () => {
		const rows = stopPanel({ kind: 'discard', erase: { node: null, forgot: 'f'.repeat(64), revoke: 'pending' }, finished: true });
		expect(rows.map((r) => r.id)).toEqual(['forget']);
		const by = Object.fromEntries(rows[0].lights.map((l) => [l.id, l]));
		expect(by.node).toMatchObject({ state: 'skipped', key: 'nodeLater', say: 'later' });
		expect(by.revoke).toMatchObject({ state: 'failed', key: 'revokeLater' });
	});

	it('marks the copies a provider refused, and a partial backup, as failed', () => {
		const partial = { phase: 'stop-partial', paperless: false, stop: { status: 'partial', request: 'r1', backup: { status: 'partial', backup: entry([copy(5, 12)], 2), log: [`${T} upload with primary 2 failed: made up`] } } };
		const rows = stopPanel({ kind: 'stop', sent: true, status: partial });
		expect(lights(rows)).toMatchObject({ 'copy-2': 'failed', 'copy-5': 'reported', confirmed: 'failed', node: 'off' });
		// The person is asked now: nothing runs and nothing failed beyond the copy.
		expect(rowStates(rows)).toMatchObject({ upload: 'failed', piece: 'failed', forget: 'off' });
	});

	it('skips the backup rows when nothing changed or backups are off', () => {
		const unchanged = { phase: 'stopped', paperless: false, stop: { status: 'ready', request: 'r1', backup: { status: 'unchanged' } } };
		const rows = stopPanel({ kind: 'stop', sent: true, status: unchanged, erase: { node: 'erased', forgot: 'f'.repeat(64) }, listed: false, finished: true });
		expect(lights(rows)).toMatchObject({ exported: 'skipped', sealed: 'skipped', copies: 'skipped', pieceCid: 'skipped', confirmed: 'skipped', listed: 'skipped' });
		expect(rowStates(rows)).toMatchObject({ export: 'done', upload: 'skipped', forget: 'done' });
	});

	it('fails the row under way when the stop failed', () => {
		const failed = { phase: 'stop-failed', paperless: true, stop: { status: 'failed', request: 'r1', backup: { status: 'failed', reason: 'made up', log: [`${T} exporting Paperless …`] } } };
		const rows = stopPanel({ kind: 'stop', sent: true, status: failed, failed: true });
		expect(currentRow(rows).id).toBe('export');
		expect(lights(rows)).toMatchObject({ exported: 'failed', node: 'off' });
	});

	it('is drawn with its own texts, in both languages, each light in words', () => {
		const rows = stopPanel({ kind: 'stop', sent: true, status: stopped([copy(2, 11)], 1, { parts: [{ pieceCid: CID }, { pieceCid: 'bafkzcibmadeuppart' }] }), erase: { node: 'erased', forgot: 'f'.repeat(64) }, listed: true, finished: true });
		for (const lang of /** @type {const} */ (['de', 'en'])) {
			const t = { ...panelTexts[lang], ...panelTexts[lang].stop };
			const { body } = render(StartPanel, { props: { rows, t, testid: 'stop-panel', times: { piece: '300 s' } } });
			expect(body).toContain('data-testid="stop-panel"');
			expect(body).toContain(lang === 'de' ? 'in 2 Teilen' : 'in 2 parts');
			expect(body).toContain(CID);
			expect(body).toContain('data-testid="took-piece"');
			for (const r of rows) expect(t.rows[r.id]).toBeTruthy();
		}
		// The same keys in both languages.
		expect(Object.keys(panelTexts.en.stop.lights).sort()).toEqual(Object.keys(panelTexts.de.stop.lights).sort());
		expect(Object.keys(panelTexts.en.stop.rows).sort()).toEqual(Object.keys(panelTexts.de.stop.rows).sort());
	});
});

describe('the evidence of a stop', () => {
	it('names the piece, each copy with its data set and the FORGET, with links only to what is real', () => {
		const forgot = 'f'.repeat(64);
		const instance = 'e'.repeat(64);
		const rows = stopEvidenceRows({ status: stopped([copy(2, 11), copy(5, 12)]), erase: { node: 'erased', forgot }, instanceHash: instance, alephApi: 'https://api.example' });
		expect(rows.map((r) => r.kind ?? r.id)).toEqual(['stopPiece', 'stopSealed', 'stopCopy', 'stopCopy', 'stopForget']);
		expect(rows[0]).toMatchObject({ mark: 'reported' });
		expect(rows[0].values).toContainEqual({ k: 'piece', v: CID, mono: true });
		expect(rows[2].values).toContainEqual({ k: 'dataSet', v: '11', mono: true });
		expect(rows[2].links).toEqual([{ k: 'retrieval', href: `https://sp2.example/piece/${CID}` }]);
		expect(rows[4]).toMatchObject({ mark: 'app' });
		expect(rows[4].links.map((l) => l.k)).toEqual(['message', 'forgetMessage']);
		for (const r of rows) {
			expect(evidenceTexts.de.rows[r.kind ?? r.id]).toBeTruthy();
			expect(evidenceTexts.en.rows[r.kind ?? r.id]).toBeTruthy();
			for (const v of r.values) expect(evidenceTexts.en.values[v.k] && evidenceTexts.de.values[v.k]).toBeTruthy();
			for (const l of r.links) expect(evidenceTexts.en.links[l.k] && evidenceTexts.de.links[l.k]).toBeTruthy();
		}
		// How it was encrypted: the method, the public recipient (copyable), whether it is the vault's key.
		const recipient = 'age1madeuprecipient';
		const sealedRow = (header) => stopEvidenceRows({ status: stopped([copy(2, 11)]), recipient, fromVault: true, header, alephApi: 'https://api.example' }).find((r) => r.id === 'stopSealed');
		expect(sealedRow(null)).toMatchObject({ mark: 'reported', note: 'headerUnchecked' });
		expect(sealedRow('refused')).toMatchObject({ mark: 'reported', note: 'headerRefused' });
		const opened = sealedRow('opens');
		expect(opened).toMatchObject({ mark: 'app', note: 'headerOpens' });
		expect(opened.values).toContainEqual({ k: 'method', v: 'age v1 · X25519 · HKDF-SHA-256 · ChaCha20-Poly1305 (64 KiB)' });
		expect(opened.values).toContainEqual({ k: 'recipient', v: recipient, mono: true, copy: true });
		expect(opened.values).toContainEqual({ k: 'keyFrom', v: 'vault', say: true });
		expect(opened.links.map((l) => l.href)).toEqual(['https://age-encryption.org/v1', 'https://github.com/Le-Space/paperless-anywhere/blob/main/docs/restore-yourself.md']);
		// In German the guide in German.
		const de = stopEvidenceRows({ status: stopped([copy(2, 11)]), recipient, fromVault: true, header: 'opens', alephApi: 'https://api.example', docsLang: 'de' }).find((r) => r.id === 'stopSealed');
		expect(de.links.map((l) => l.href)).toContain('https://github.com/Le-Space/paperless-anywhere/blob/main/docs/restore-yourself.de.md');
		// Never a secret: only the public recipient appears among the values.
		expect(JSON.stringify(opened)).not.toMatch(/AGE-SECRET-KEY/i);
		for (const lang of ['de', 'en']) {
			const t = evidenceTexts[lang];
			expect(t.rows.stopSealed && t.says.vault && t.says.profile && t.says.luks && t.copy && t.copied).toBeTruthy();
			for (const n of ['headerOpens', 'headerRefused', 'headerUnchecked']) expect(t.notes[n]).toBeTruthy();
			for (const l of opened.links) expect(t.links[l.k]).toBeTruthy();
		}
		// An erase without backup: the FORGET only.
		expect(stopEvidenceRows({ status: null, erase: { node: null, forgot }, instanceHash: instance, alephApi: 'https://api.example' }).map((r) => r.id)).toEqual(['stopForget']);
	});
});
