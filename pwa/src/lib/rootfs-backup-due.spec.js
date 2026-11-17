// When the VM backs up on its own and when it retains (rootfs/files):
// paperless-backup-due decides, paperless-backup-loop and paperless-backup
// ask it. Each AddPieces and each SchedulePieceRemovals costs a fee, so a
// scheduled backup waits for a change, 30 quiet minutes and some hours since
// the last one, and retention runs once a day. Each case starts sh anew.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const files = new URL('../../../rootfs/files/', import.meta.url).pathname;
const source = (/** @type {string} */ name) => readFileSync(join(files, name), 'utf8');

const T = 1_800_000_000;
const MIN = 60;
const HOUR = 3600;

function vm() {
	const base = mkdtempSync(join(tmpdir(), 'backup-due-'));
	const dirs = { run: join(base, 'run'), lib: join(base, 'lib'), secrets: join(base, 'secrets') };
	for (const d of Object.values(dirs)) mkdirSync(d);
	/** @param {string[]} args @param {string} [input] */
	const sh = (args, input = '') => {
		const r = spawnSync('sh', [join(files, 'paperless-backup-due'), ...args], {
			encoding: 'utf8',
			input,
			env: { PATH: process.env.PATH, PAPERLESS_RUN_DIR: dirs.run, PAPERLESS_LIB_DIR: dirs.lib, PAPERLESS_SECRETS_DIR: dirs.secrets }
		});
		expect(r.status, r.stderr).toBe(0);
		return r.stdout.trim();
	};
	return {
		...dirs,
		/** Paperless's fingerprint at `now`: "due" or "wait". */
		backup: (/** @type {string} */ fp, /** @type {number} */ now) => sh(['backup', String(now)], fp),
		retain: (/** @type {number} */ now) => sh(['retain', String(now)]),
		retained: (/** @type {number} */ now) => sh(['retained', String(now)]),
		/** What paperless-backup records after a backup that started at `at`. */
		backedUp: (/** @type {string} */ fp, /** @type {number} */ at, status = 'done') => {
			if (status === 'done') writeFileSync(join(dirs.lib, 'backed-up.fingerprint'), `${fp}\n`);
			writeFileSync(join(dirs.lib, 'backup-last.json'), JSON.stringify({ at, status }));
		},
		config: (/** @type {object} */ c) => writeFileSync(join(dirs.secrets, 'backup_config'), JSON.stringify(c)),
		schedule: () => JSON.parse(readFileSync(join(dirs.run, 'backup-schedule.json'), 'utf8'))
	};
}

const iso = (/** @type {number} */ t) => new Date(t * 1000).toISOString().replace('.000Z', 'Z');

describe('paperless-backup-due backup', { timeout: 30_000 }, () => {
	it('waits while nothing changed since the last backup', () => {
		const v = vm();
		v.backedUp('A', T - 24 * HOUR);
		expect(v.backup('A', T)).toBe('wait');
		expect(v.backup('A', T + 48 * HOUR)).toBe('wait');
		expect(v.schedule()).toMatchObject({ pending: false, nextBackup: null });
	});

	it('backs up a change after 30 quiet minutes once the last backup is six hours old', () => {
		const v = vm();
		v.backedUp('A', T - 24 * HOUR);
		expect(v.backup('B', T)).toBe('wait');
		expect(v.schedule()).toMatchObject({ pending: true, nextBackup: iso(T + 30 * MIN), quietSince: iso(T), minSeconds: 6 * HOUR });
		expect(v.backup('B', T + 20 * MIN)).toBe('wait');
		expect(v.backup('B', T + 30 * MIN)).toBe('due');
	});

	it('waits again whenever Paperless changes once more', () => {
		const v = vm();
		v.backedUp('A', T - 24 * HOUR);
		v.backup('B', T);
		v.backup('C', T + 25 * MIN);
		expect(v.backup('C', T + 30 * MIN)).toBe('wait');
		expect(v.schedule().nextBackup).toBe(iso(T + 55 * MIN));
		expect(v.backup('C', T + 55 * MIN)).toBe('due');
	});

	it('keeps six hours between backups by default', () => {
		const v = vm();
		v.backedUp('A', T);
		v.backup('B', T + 10 * MIN);
		expect(v.backup('B', T + 2 * HOUR)).toBe('wait');
		expect(v.schedule().nextBackup).toBe(iso(T + 6 * HOUR));
		expect(v.backup('B', T + 6 * HOUR - 1)).toBe('wait');
		expect(v.backup('B', T + 6 * HOUR)).toBe('due');
	});

	it('takes the gap from backup_config schedule.minHours, 1 to 24', () => {
		const v = vm();
		v.config({ network: 'mainnet', schedule: { minHours: 4 } });
		v.backedUp('A', T);
		v.backup('B', T + 10 * MIN);
		expect(v.backup('B', T + 4 * HOUR)).toBe('due');
		expect(v.schedule().minSeconds).toBe(4 * HOUR);
		for (const minHours of [0, 25, 4.5, '4', true, null]) {
			v.config({ schedule: { minHours } });
			v.backup('B', T + 4 * HOUR);
			expect(v.schedule().minSeconds, String(minHours)).toBe(6 * HOUR);
		}
	});

	it('tries again two hours after a failed or interrupted backup', () => {
		for (const status of ['failed', 'running']) {
			const v = vm();
			v.backedUp('A', T - 24 * HOUR);
			v.backedUp('B', T, status);
			v.backup('B', T - HOUR);
			expect(v.backup('B', T + HOUR), status).toBe('wait');
			expect(v.backup('B', T + 2 * HOUR), status).toBe('due');
		}
	});

	it('waits the full gap after a partial backup (it uploaded)', () => {
		const v = vm();
		v.backedUp('A', T - 24 * HOUR);
		v.backedUp('B', T, 'partial');
		v.backup('B', T - HOUR);
		expect(v.backup('B', T + 2 * HOUR)).toBe('wait');
		expect(v.backup('B', T + 6 * HOUR)).toBe('due');
	});

	it('backs up the first change of a fresh VM after 30 quiet minutes', () => {
		const v = vm();
		expect(v.backup('A', T)).toBe('wait');
		expect(v.backup('A', T + 30 * MIN)).toBe('due');
	});

	it('does nothing while Paperless cannot be read', () => {
		const v = vm();
		v.backedUp('A', T - 24 * HOUR);
		v.backup('B', T);
		expect(v.backup('', T + HOUR)).toBe('wait');
		expect(v.schedule()).toMatchObject({ pending: false, nextBackup: null });
		// The quiet time it saw before still counts.
		expect(v.backup('B', T + HOUR)).toBe('due');
	});

	it('remembers the quiet time across a restart of the loop', () => {
		const v = vm();
		v.backedUp('A', T - 24 * HOUR);
		v.backup('B', T);
		expect(existsSync(join(v.lib, 'backup-watch.json'))).toBe(true);
		expect(v.backup('B', T + 31 * MIN)).toBe('due');
	});

	it('reports when the next look is due', () => {
		const v = vm();
		v.backup('A', T);
		expect(v.schedule()).toMatchObject({ nextCheck: iso(T + 600), everySeconds: 600, quietSeconds: 30 * MIN });
	});
});

describe('paperless-backup-due retain', { timeout: 30_000 }, () => {
	it('is due when it never ran, then once a day', () => {
		const v = vm();
		expect(v.retain(T)).toBe('due');
		v.retained(T);
		expect(v.retain(T + 2 * HOUR)).toBe('wait');
		expect(v.retain(T + 24 * HOUR - 1)).toBe('wait');
		expect(v.retain(T + 24 * HOUR)).toBe('due');
	});
	it('is due when the clock went back past its last run', () => {
		const v = vm();
		v.retained(T);
		expect(v.retain(T - HOUR)).toBe('due');
	});
});

describe('the scripts ask paperless-backup-due', () => {
	it('the loop backs up on its own only when it is due', () => {
		const loop = source('paperless-backup-loop');
		expect(loop).toContain('paperless-backup-due backup');
		expect(loop).not.toMatch(/EVERY=7200/);
		const scheduled = loop.slice(loop.indexOf('if [ "$(date +%s)" -ge "$next" ]'));
		expect(scheduled).toMatch(/if \[ "\$\(due "\$fp"\)" = due \]; then\n\s+\/usr\/local\/sbin\/paperless-backup check/);
	});
	it('a requested backup does not wait for the schedule', () => {
		const loop = source('paperless-backup-loop');
		const requested = loop.slice(loop.indexOf('backup_request ]'), loop.indexOf('if [ "$(date +%s)" -ge "$next" ]'));
		expect(requested).toContain('/usr/local/sbin/paperless-backup "$mode"');
		expect(requested).not.toContain('paperless-backup-due');
	});
	it('paperless-backup retains only when it is due, and notes it after', () => {
		const backup = source('paperless-backup');
		const gate = backup.indexOf('[ "$(/usr/local/sbin/paperless-backup-due retain)" = due ] || exit 0');
		expect(gate).toBeGreaterThan(backup.indexOf('status done'));
		expect(gate).toBeLessThan(backup.indexOf('node backup.mjs retain'));
		expect(backup.indexOf('paperless-backup-due retained')).toBeGreaterThan(backup.indexOf('node backup.mjs retain'));
	});
	it('paperless-backup records when each backup started and how it ended', () => {
		const backup = source('paperless-backup');
		for (const s of ['running', 'failed', 'partial', 'done']) expect(backup).toContain(`last_backup ${s}`);
	});
	it('the image installs it', () => {
		expect(readFileSync(new URL('../../../rootfs/build-image.sh', import.meta.url), 'utf8')).toMatch(/paperless-backup-due/);
	});
});
