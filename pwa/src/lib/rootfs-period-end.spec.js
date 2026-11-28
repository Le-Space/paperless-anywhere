// The VM's own stop before the end of the paid period (rootfs/files):
// when paperless-period-end says the last backup is due, and what the status
// pages then say. Each case starts sh or python3 anew.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const files = new URL('../../../rootfs/files/', import.meta.url).pathname;
const source = (/** @type {string} */ name) => readFileSync(join(files, name), 'utf8');

const END = 1_800_000_000;
const HOUR = 3600;

/**
 * @param {{ end?: string | null, now: number, stop?: object | null, restore?: object | null }} o
 * @returns {string} what the script printed
 */
function due({ end = String(END), now, stop = null, restore = null }) {
	const base = mkdtempSync(join(tmpdir(), 'period-end-'));
	const run = join(base, 'run');
	const secrets = join(base, 'secrets');
	mkdirSync(run);
	mkdirSync(secrets);
	if (end !== null) writeFileSync(join(secrets, 'period_end'), end);
	if (stop) writeFileSync(join(run, 'stop.json'), JSON.stringify(stop));
	if (restore) writeFileSync(join(run, 'restore.json'), JSON.stringify(restore));
	const r = spawnSync('sh', [join(files, 'paperless-period-end'), String(now)], {
		encoding: 'utf8',
		env: { PATH: process.env.PATH, PAPERLESS_RUN_DIR: run, PAPERLESS_SECRETS_DIR: secrets }
	});
	expect(r.status, r.stderr).toBe(0);
	return r.stdout.trim();
}

describe('paperless-period-end', { timeout: 30_000 }, () => {
	it('is due one hour before the end, not earlier', () => {
		expect(due({ now: END - HOUR - 1 })).toBe('');
		expect(due({ now: END - HOUR })).toBe(`period-end-${END - HOUR}`);
		expect(due({ now: END + 5 })).toBe(`period-end-${END + 5}`);
	});
	it('is never due without an end, or with 0 (a period that renews)', () => {
		for (const end of [null, '', '0', 'abc']) expect(due({ end, now: END }), String(end)).toBe('');
	});
	it('takes only the digits of the secret', () => {
		expect(due({ end: `${END}\n`, now: END })).toBe(`period-end-${END}`);
	});
	it('waits while a restore runs', () => {
		expect(due({ now: END, restore: { status: 'running' } })).toBe('');
		expect(due({ now: END, restore: { status: 'done' } })).toBe(`period-end-${END}`);
	});
	it('makes no second stop while one runs or after one ended', () => {
		for (const status of ['running', 'ready', 'partial']) {
			expect(due({ now: END, stop: { status, request: '17000', reason: 'app' } }), status).toBe('');
			expect(due({ now: END, stop: { status, request: `period-end-${END - HOUR}`, reason: 'period-end' } }), status).toBe('');
		}
	});
	it('stops after a failed stop the app asked for', () => {
		expect(due({ now: END, stop: { status: 'failed', request: '17000', reason: 'app' } })).toBe(`period-end-${END}`);
	});
	it('tries a failed period-end stop again after 15 minutes', () => {
		const stop = { status: 'failed', request: `period-end-${END - HOUR}`, reason: 'period-end' };
		expect(due({ now: END - HOUR + 899, stop })).toBe('');
		expect(due({ now: END - HOUR + 900, stop })).toBe(`period-end-${END - HOUR + 900}`);
	});
	it('does not stop again after the person kept the VM at a partial backup', () => {
		const stop = { status: 'resumed', request: `period-end-${END - HOUR}`, reason: 'period-end' };
		expect(due({ now: END, stop })).toBe('');
		// A later end (a new period) is a new stop.
		expect(due({ end: String(END + 7 * 24 * HOUR), now: END + 7 * 24 * HOUR, stop })).toBe(`period-end-${END + 7 * 24 * HOUR}`);
	});
});

describe('paperless-stop', () => {
	const stop = source('paperless-stop');
	it('asks paperless-period-end when the app sent no new request', () => {
		expect(stop).toMatch(/request="\$\(paperless-period-end 2>\/dev\/null \|\| true\)"/);
		expect(stop).toMatch(/if \[ -n "\$request" \]; then\n\s+reason=period-end/);
	});
	it('names the reason in stop.json', () => {
		expect(stop).toMatch(/"reason":"%s"/);
	});
	it('is installed into the image', () => {
		expect(readFileSync(new URL('../../../rootfs/build-image.sh', import.meta.url), 'utf8')).toMatch(/\bpaperless-period-end\b/);
	});
});

describe('the status pages at the period end', { timeout: 30_000 }, () => {
	const py = /<<'PY' && mv[^\n]*\n([\s\S]*?)\nPY\n/.exec(source('paperless-status'))?.[1] ?? '';
	/** @param {object} stop @param {string | null} end */
	function pages(stop, end) {
		const dir = mkdtempSync(join(tmpdir(), 'status-end-'));
		writeFileSync(join(dir, 'stop.json'), JSON.stringify(stop));
		writeFileSync(join(dir, 'token'), 'a'.repeat(32));
		if (end !== null) writeFileSync(join(dir, 'period_end'), end);
		const code = py
			.replace('/tmp/secrets/status_token', join(dir, 'token'))
			.replace('/tmp/secrets/period_end', join(dir, 'period_end'))
			.replace('/var/lib/paperless-anywhere/last-backup.json', join(dir, 'last.json'))
			.replace('/var/lib/paperless-anywhere/backup-marks.json', join(dir, 'marks.json'));
		const r = spawnSync('python3', ['-I', '-', dir, 'false', 'true', '5', '5', '0', 'true'], { input: code, encoding: 'utf8' });
		expect(r.status, r.stderr).toBe(0);
		return { open: JSON.parse(r.stdout), full: JSON.parse(readFileSync(join(dir, 'public', 's', `${'a'.repeat(32)}.json`), 'utf8')) };
	}
	it('say "stopped" with the reason "period-end", and the end the app handed over', () => {
		const { open, full } = pages({ status: 'ready', request: `period-end-${END - HOUR}`, reason: 'period-end', at: 'x', backup: { status: 'done', pieceCid: 'bafkzcibtest' } }, String(END));
		expect(open).toMatchObject({ phase: 'stopped', stopReason: 'period-end' });
		expect(JSON.stringify(open)).not.toContain('bafk');
		expect(full).toMatchObject({ phase: 'stopped', stopReason: 'period-end', periodEnd: END });
	});
	it('name no reason while Paperless runs, and no end without one', () => {
		const { open, full } = pages({ status: 'resumed', request: '1', reason: 'app' }, null);
		expect(open.stopReason).toBeUndefined();
		expect(full.stopReason).toBeNull();
		expect(full.periodEnd).toBeNull();
	});
});
