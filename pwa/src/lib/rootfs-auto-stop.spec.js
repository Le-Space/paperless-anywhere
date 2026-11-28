// The VM's own stop that the person chose (rootfs/files, docs/auto-stop.md):
// when paperless-auto-stop says a quiet or the daily stop is due, how
// paperless-stop asks it, what Caddy logs for it, and what the status pages
// then say. Each case starts sh or python3 anew.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const files = new URL('../../../rootfs/files/', import.meta.url).pathname;
const source = (/** @type {string} */ name) => readFileSync(join(files, name), 'utf8');

// 2027-01-15T08:00:00Z, 09:00 in Berlin (CET, UTC+1).
const T0 = 1_800_000_000;
const MIN = 60;
const HOUR = 3600;
const IDLE = { v: 1, idleMinutes: 60, dailyAt: null, tz: 'Europe/Berlin', utcOffsetMinutes: 60, postponeUntil: 0 };
const DAILY = { ...IDLE, idleMinutes: null, dailyAt: '18:00' };
// 18:00 in Berlin that day: 17:00Z.
const SIX_PM = T0 + 9 * HOUR;

/**
 * @param {{ setting?: object | string | null, since?: number, now: number, log?: [number, string][], rolled?: [number, string][],
 *   stop?: object | null, stopAt?: number, restore?: object | null, restoreAt?: number, busy?: '0' | '1' | null, consume?: string[] }} o
 */
function run({ setting = IDLE, since = T0, now, log = [], rolled = [], stop = null, stopAt = now, restore = null, restoreAt = now, busy = '0', consume = [] }) {
	const base = mkdtempSync(join(tmpdir(), 'auto-stop-'));
	const dirs = { run: join(base, 'run'), secrets: join(base, 'secrets'), activity: join(base, 'activity'), consume: join(base, 'consume') };
	for (const d of Object.values(dirs)) mkdirSync(d);
	if (setting !== null) {
		writeFileSync(join(dirs.secrets, 'auto_stop'), typeof setting === 'string' ? setting : JSON.stringify(setting));
		// The setting as paperless-auto-stop recorded it when it first arrived.
		if (typeof setting === 'object') {
			const { v, postponeUntil, ...same } = /** @type {any} */ (setting);
			writeFileSync(join(dirs.run, 'auto-stop-seen.json'), JSON.stringify({ setting: same, since }));
		}
	}
	const line = (/** @type {[number, string]} */ [ts, uri]) => JSON.stringify({ level: 'info', ts: ts + 0.25, request: { method: 'GET', uri }, status: 200 });
	writeFileSync(join(dirs.activity, 'access.log'), log.map(line).join('\n') + (log.length ? '\n' : ''));
	if (rolled.length) writeFileSync(join(dirs.activity, 'access-2027-01-15T07-00-00.000.log'), rolled.map(line).join('\n') + '\n');
	if (stop) {
		writeFileSync(join(dirs.run, 'stop.json'), JSON.stringify(stop));
		utimesSync(join(dirs.run, 'stop.json'), stopAt, stopAt);
	}
	if (restore) {
		writeFileSync(join(dirs.run, 'restore.json'), JSON.stringify(restore));
		utimesSync(join(dirs.run, 'restore.json'), restoreAt, restoreAt);
	}
	for (const f of consume) writeFileSync(join(dirs.consume, f), 'x');
	/** @type {Record<string, string>} */
	const env = {
		PATH: process.env.PATH ?? '',
		PAPERLESS_RUN_DIR: dirs.run,
		PAPERLESS_SECRETS_DIR: dirs.secrets,
		PAPERLESS_ACCESS_LOG: join(dirs.activity, 'access.log'),
		PAPERLESS_CONSUME_DIR: dirs.consume
	};
	if (busy !== null) env.PAPERLESS_AUTO_STOP_BUSY = busy;
	const r = spawnSync('sh', [join(files, 'paperless-auto-stop'), String(now)], { encoding: 'utf8', env });
	expect(r.status, r.stderr).toBe(0);
	let state = null;
	try {
		state = JSON.parse(readFileSync(join(dirs.run, 'auto-stop.json'), 'utf8'));
	} catch {
		/* not written */
	}
	return { out: r.stdout.trim(), state, seen: (() => { try { return JSON.parse(readFileSync(join(dirs.run, 'auto-stop-seen.json'), 'utf8')); } catch { return null; } })() };
}
const due = (/** @type {Parameters<typeof run>[0]} */ o) => run(o).out;

describe('paperless-auto-stop: the quiet time', { timeout: 60_000 }, () => {
	it('is due once nobody used Paperless for the chosen minutes since the setting arrived', () => {
		expect(due({ now: T0 + HOUR - 1 })).toBe('');
		expect(due({ now: T0 + HOUR })).toBe(`idle-${T0 + HOUR}`);
	});
	it('counts from the last request to Paperless, also in the file Caddy rolled', () => {
		expect(due({ now: T0 + HOUR, log: [[T0 + 30 * MIN, '/documents/12/?']] })).toBe('');
		expect(due({ now: T0 + 90 * MIN, log: [[T0 + 30 * MIN, '/documents/12/?']] })).toBe(`idle-${T0 + 90 * MIN}`);
		expect(due({ now: T0 + HOUR, rolled: [[T0 + 30 * MIN, '/api/documents/']] })).toBe('');
	});
	it('does not count the polls of an open Paperless tab, nor the status pages', () => {
		const log = /** @type {[number, string][]} */ (['/api/tasks/?', '/ws/status/', '/api/remote_version/', '/api/status/', '/anywhere/status.json'].map((u) => [T0 + 50 * MIN, u]));
		expect(due({ now: T0 + HOUR, log })).toBe(`idle-${T0 + HOUR}`);
		// A real request before the polls still counts.
		expect(due({ now: T0 + HOUR, log: [[T0 + 40 * MIN, '/dashboard'], ...log] })).toBe('');
	});
	it('waits while Paperless still works: files to consume, or tasks in its queue', () => {
		expect(due({ now: T0 + HOUR, busy: '1' })).toBe('');
		expect(due({ now: T0 + HOUR, busy: null, consume: ['scan.pdf'] })).toBe('');
		expect(due({ now: T0 + HOUR, busy: null, consume: ['.stfolder'] })).toBe(`idle-${T0 + HOUR}`);
	});
	it('counts anew when the setting changed, not when the same one is handed over again', () => {
		const first = run({ now: T0 + HOUR, setting: { ...IDLE, idleMinutes: 120 }, since: T0 });
		expect(first.out).toBe('');
		expect(first.seen.since).toBe(T0);
		// The seen record holds 60 minutes; a hand-over with 90 is new.
		const base = mkdtempSync(join(tmpdir(), 'auto-stop-seen-'));
		mkdirSync(join(base, 'run'));
		mkdirSync(join(base, 'secrets'));
		writeFileSync(join(base, 'run', 'auto-stop-seen.json'), JSON.stringify({ setting: { idleMinutes: 60, dailyAt: null, tz: 'Europe/Berlin', utcOffsetMinutes: 60 }, since: T0 }));
		writeFileSync(join(base, 'secrets', 'auto_stop'), JSON.stringify({ ...IDLE, idleMinutes: 90 }));
		const env = { PATH: process.env.PATH ?? '', PAPERLESS_RUN_DIR: join(base, 'run'), PAPERLESS_SECRETS_DIR: join(base, 'secrets'), PAPERLESS_ACCESS_LOG: join(base, 'none.log'), PAPERLESS_AUTO_STOP_BUSY: '0' };
		const r = spawnSync('sh', [join(files, 'paperless-auto-stop'), String(T0 + 2 * HOUR)], { encoding: 'utf8', env });
		expect(r.stdout.trim()).toBe('');
		expect(JSON.parse(readFileSync(join(base, 'run', 'auto-stop-seen.json'), 'utf8')).since).toBe(T0 + 2 * HOUR);
		// A postpone alone is the same setting.
		expect(due({ now: T0 + HOUR, setting: { ...IDLE, postponeUntil: T0 + 10 } })).toBe(`idle-${T0 + HOUR}`);
	});
	it('counts from a finished restore, and from a stop the person resumed', () => {
		expect(due({ now: T0 + HOUR, restore: { status: 'done' }, restoreAt: T0 + 30 * MIN })).toBe('');
		expect(due({ now: T0 + HOUR, stop: { status: 'resumed', request: `idle-${T0}`, reason: 'idle' }, stopAt: T0 + 30 * MIN })).toBe('');
		expect(due({ now: T0 + 90 * MIN, stop: { status: 'resumed', request: `idle-${T0}`, reason: 'idle' }, stopAt: T0 + 30 * MIN })).toBe(`idle-${T0 + 90 * MIN}`);
	});
});

describe('paperless-auto-stop: the daily hour', { timeout: 60_000 }, () => {
	it('is due at the hour in the person’s zone', () => {
		expect(due({ setting: DAILY, since: T0, now: SIX_PM - 1 })).toBe('');
		expect(due({ setting: DAILY, since: T0, now: SIX_PM })).toBe(`schedule-${SIX_PM}`);
		expect(due({ setting: DAILY, since: T0, now: SIX_PM + 3 * HOUR })).toBe(`schedule-${SIX_PM + 3 * HOUR}`);
	});
	it('keeps the local hour in summer time', () => {
		// 2027-07-15T08:00:00Z; 18:00 CEST is 16:00Z.
		const summer = Date.UTC(2027, 6, 15, 8) / 1000;
		expect(due({ setting: DAILY, since: summer, now: summer + 8 * HOUR - 1 })).toBe('');
		expect(due({ setting: DAILY, since: summer, now: summer + 8 * HOUR })).toBe(`schedule-${summer + 8 * HOUR}`);
	});
	it('takes the fixed offset when the zone is unknown', () => {
		const setting = { ...DAILY, tz: 'Nowhere/Atlantis', utcOffsetMinutes: 120 };
		expect(due({ setting, since: T0, now: SIX_PM - HOUR - 1 })).toBe('');
		expect(due({ setting, since: T0, now: SIX_PM - HOUR })).toBe(`schedule-${SIX_PM - HOUR}`);
	});
	it('is not due for an hour that passed before the setting arrived', () => {
		expect(due({ setting: DAILY, since: SIX_PM + 30 * MIN, now: SIX_PM + HOUR })).toBe('');
		// The next day it is.
		expect(due({ setting: DAILY, since: SIX_PM + 30 * MIN, now: SIX_PM + 24 * HOUR })).toBe(`schedule-${SIX_PM + 24 * HOUR}`);
	});
	it('waits for ten quiet minutes, so it does not cut someone off mid-click', () => {
		expect(due({ setting: DAILY, since: T0, now: SIX_PM + 5 * MIN, log: [[SIX_PM, '/documents/']] })).toBe('');
		expect(due({ setting: DAILY, since: T0, now: SIX_PM + 10 * MIN, log: [[SIX_PM, '/documents/']] })).toBe(`schedule-${SIX_PM + 10 * MIN}`);
	});
	it('is not repeated for the same hour after the person kept the VM', () => {
		const stop = { status: 'resumed', request: `schedule-${SIX_PM}`, reason: 'schedule' };
		expect(due({ setting: DAILY, since: T0, now: SIX_PM + 2 * HOUR, stop, stopAt: SIX_PM + 20 * MIN })).toBe('');
		expect(due({ setting: DAILY, since: T0, now: SIX_PM + 24 * HOUR, stop, stopAt: SIX_PM + 20 * MIN })).toBe(`schedule-${SIX_PM + 24 * HOUR}`);
	});
});

describe('paperless-auto-stop: when nothing is due', { timeout: 60_000 }, () => {
	it('is off without the secret, with both null, or with values out of range', () => {
		for (const setting of [null, '', 'nonsense', '[]', { ...IDLE, idleMinutes: null }, { ...IDLE, idleMinutes: 5 }, { ...IDLE, idleMinutes: 2000 }, { ...DAILY, dailyAt: '24:00' }]) {
			expect(due({ setting, now: T0 + 30 * HOUR }), JSON.stringify(setting)).toBe('');
		}
	});
	it('waits until the postponed time', () => {
		expect(due({ setting: { ...IDLE, postponeUntil: T0 + 2 * HOUR }, now: T0 + HOUR })).toBe('');
		expect(due({ setting: { ...IDLE, postponeUntil: T0 + 2 * HOUR }, now: T0 + 2 * HOUR })).toBe(`idle-${T0 + 2 * HOUR}`);
	});
	it('never while a restore runs, nor while a stop runs or after one ended', () => {
		expect(due({ now: T0 + HOUR, restore: { status: 'running' } })).toBe('');
		for (const status of ['running', 'ready', 'partial']) {
			expect(due({ now: T0 + HOUR, stop: { status, request: '17000', reason: 'app' }, stopAt: T0 }), status).toBe('');
		}
	});
	it('tries a failed auto-stop again after 15 minutes; a failed stop of the app does not hold it', () => {
		const stop = { status: 'failed', request: `idle-${T0 + HOUR}`, reason: 'idle' };
		expect(due({ now: T0 + HOUR + 899, stop, stopAt: T0 })).toBe('');
		expect(due({ now: T0 + HOUR + 900, stop, stopAt: T0 })).toBe(`idle-${T0 + HOUR + 900}`);
		expect(due({ now: T0 + HOUR, stop: { status: 'failed', request: '17000', reason: 'app' }, stopAt: T0 })).toBe(`idle-${T0 + HOUR}`);
	});
});

describe('paperless-auto-stop: what it tells the status pages', { timeout: 30_000 }, () => {
	it('writes the setting, the last request it counted and when each stop is due', () => {
		const { state } = run({ setting: { ...IDLE, dailyAt: '18:00' }, now: T0 + 10 * MIN, log: [[T0 + 5 * MIN, '/documents/']] });
		expect(state).toMatchObject({
			setting: { idleMinutes: 60, dailyAt: '18:00', tz: 'Europe/Berlin' },
			lastRequest: '2027-01-15T08:05:00Z',
			quietSince: '2027-01-15T08:05:00Z',
			idleAt: '2027-01-15T09:05:00Z',
			dailyAt: '2027-01-15T17:00:00Z',
			postponeUntil: null
		});
	});
});

describe('paperless-stop and the image', () => {
	const stop = source('paperless-stop');
	it('asks paperless-auto-stop only after the period end, and only with the secret', () => {
		expect(stop.indexOf('paperless-period-end 2>/dev/null')).toBeLessThan(stop.indexOf('paperless-auto-stop 2>/dev/null'));
		expect(stop).toMatch(/elif \[ -s \/tmp\/secrets\/auto_stop \]; then/);
		expect(stop).toMatch(/idle-\*\) reason=idle ;;/);
		expect(stop).toMatch(/schedule-\*\) reason=schedule ;;/);
	});
	it('is installed into the image', () => {
		expect(readFileSync(new URL('../../../rootfs/build-image.sh', import.meta.url), 'utf8')).toMatch(/\bpaperless-auto-stop\b/);
	});
});

describe('paperless-https: the access log for the quiet time', { timeout: 30_000 }, () => {
	/** @param {{ host: string, fixed: boolean }} o */
	function caddyfile({ host, fixed }) {
		const root = mkdtempSync(join(tmpdir(), 'https-log-'));
		for (const d of ['tmp/secrets', 'etc/caddy', 'etc/paperless-anywhere', 'var/lib/caddy/fixed', 'bin']) mkdirSync(join(root, d), { recursive: true });
		if (fixed) {
			writeFileSync(join(root, 'tmp/secrets/dns_cloudflare_token'), 'x');
			writeFileSync(join(root, 'tmp/secrets/https_port'), '24005');
			writeFileSync(join(root, 'var/lib/caddy/fixed/cert.pem'), 'pem');
		}
		writeFileSync(join(root, 'bin/systemctl'), '#!/bin/sh\nexit 0\n');
		chmodSync(join(root, 'bin/systemctl'), 0o755);
		const r = spawnSync('sh', [join(files, 'paperless-https'), '--early', host], { encoding: 'utf8', env: { PATH: `${join(root, 'bin')}:${process.env.PATH}`, PAPERLESS_ROOT: root } });
		expect(r.status, r.stderr).toBe(0);
		return readFileSync(join(root, 'etc/caddy/Caddyfile'), 'utf8');
	}
	it('logs the Paperless site only, to memory, without addresses, headers or the query', () => {
		for (const o of [{ host: 'abc.vm.example.org', fixed: true }, { host: 'a-b-c-d.2n6.me', fixed: false }]) {
			const caddy = caddyfile(o);
			expect(caddy.match(/output file \/run\/paperless-anywhere-activity\/access\.log/g), o.host).toHaveLength(1);
			// In the Paperless site, before its proxy (the 2n6 status-only site comes after it).
			expect(caddy.indexOf('output file')).toBeLessThan(caddy.indexOf('reverse_proxy'));
			for (const field of ['request>remote_ip delete', 'request>client_ip delete', 'request>headers delete', 'resp_headers delete']) expect(caddy).toContain(field);
			expect(caddy).toContain('request>uri regexp \\?.*$ ?');
			// The status pages are read every few seconds: never logged.
			expect(caddy.match(/handle (\/anywhere\/status\.json|@detail) \{\n\s+skip_log\n/g)?.length).toBe(o.fixed ? 4 : 2);
		}
	});
	it('keeps the log where paperless-auto-stop reads it', () => {
		expect(source('paperless-auto-stop')).toContain('/run/paperless-anywhere-activity/access.log');
	});
});

describe('the status pages after an auto-stop', { timeout: 30_000 }, () => {
	const py = /<<'PY' && mv[^\n]*\n([\s\S]*?)\nPY\n/.exec(source('paperless-status'))?.[1] ?? '';
	/** @param {object} stop @param {object | null} autoStop */
	function pages(stop, autoStop) {
		const dir = mkdtempSync(join(tmpdir(), 'status-auto-'));
		writeFileSync(join(dir, 'stop.json'), JSON.stringify(stop));
		writeFileSync(join(dir, 'token'), 'a'.repeat(32));
		if (autoStop) {
			writeFileSync(join(dir, 'auto_stop'), JSON.stringify(IDLE));
			writeFileSync(join(dir, 'auto-stop.json'), JSON.stringify(autoStop));
		}
		const code = py
			.replace('/tmp/secrets/status_token', join(dir, 'token'))
			.replace('/tmp/secrets/period_end', join(dir, 'period_end'))
			.replace('/tmp/secrets/auto_stop', join(dir, 'auto_stop'))
			.replace('/var/lib/paperless-anywhere/last-backup.json', join(dir, 'last.json'))
			.replace('/var/lib/paperless-anywhere/backup-marks.json', join(dir, 'marks.json'));
		const r = spawnSync('python3', ['-I', '-', dir, 'false', 'true', '5', '5', '0', 'true'], { input: code, encoding: 'utf8' });
		expect(r.status, r.stderr).toBe(0);
		return { open: JSON.parse(r.stdout), full: JSON.parse(readFileSync(join(dir, 'public', 's', `${'a'.repeat(32)}.json`), 'utf8')) };
	}
	it('say "stopped" with the reason "idle" or "schedule", and the setting only on the private page', () => {
		for (const reason of ['idle', 'schedule']) {
			const { open, full } = pages({ status: 'ready', request: `${reason}-${T0}`, reason, at: 'x', backup: { status: 'done' } }, { setting: { idleMinutes: 60 }, idleAt: 'x' });
			expect(open).toMatchObject({ phase: 'stopped', stopReason: reason });
			expect(open.autoStop).toBeUndefined();
			expect(full).toMatchObject({ phase: 'stopped', stopReason: reason, autoStop: { setting: { idleMinutes: 60 } } });
		}
	});
	it('name no auto-stop without the secret', () => {
		const { full } = pages({ status: 'resumed', request: '1', reason: 'app' }, null);
		expect(full.autoStop).toBeNull();
	});
});
