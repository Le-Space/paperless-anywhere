// A large restore and the VM's memory (rootfs/files/paperless-restore,
// paperless-data-disk). Tika and Gotenberg pause for the import and start
// again whatever happened; the outcome carries the memory figures; the swap
// lives on the sealed area only. 2026-11-19: a 1.1 GB import on a 4 GiB VM
// without swap left the whole VM silent. The script's own lines run here
// with sh and a made-up docker.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = readFileSync(new URL('../../../rootfs/files/paperless-restore', import.meta.url), 'utf8');
const disk = readFileSync(new URL('../../../rootfs/files/paperless-data-disk', import.meta.url), 'utf8');
const fn = (/** @type {string} */ name) => script.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`, 'm'))?.[0] ?? script.match(new RegExp(`^${name}\\(\\) \\{.*\\}$`, 'm'))?.[0];
const helpers = script.slice(script.indexOf('\npaused=""'), script.indexOf('\ncleanup() {'));

/** pause, then what follows (an import that works or fails), then the EXIT trap's cleanup. */
function run({ dockerFails = false, importFails = false }) {
	const dir = mkdtempSync(join(tmpdir(), 'restore-memory-'));
	writeFileSync(join(dir, 'docker'), `#!/bin/sh\necho "$*" >> '${dir}/docker.log'\n${dockerFails ? 'exit 1' : 'exit 0'}\n`);
	chmodSync(join(dir, 'docker'), 0o755);
	const sh = [
		`PATH='${dir}':$PATH; log='${dir}/restore.log'`,
		helpers,
		'cleanup() {\n  resume_helpers\n}',
		'trap cleanup EXIT',
		'pause_helpers || echo "not paused"',
		importFails ? 'exit 1' : 'resume_helpers; echo imported'
	].join('\n');
	const out = spawnSync('sh', ['-c', sh], { encoding: 'utf8' }).stdout.trim();
	let docker = '';
	try {
		docker = readFileSync(join(dir, 'docker.log'), 'utf8').trim();
	} catch {
		/* docker never called */
	}
	return { out, docker: docker.split('\n').filter(Boolean).map((l) => l.replace('compose --project-directory /opt/paperless ', '')) };
}

describe('Tika and Gotenberg during the import', { timeout: 30_000 }, () => {
	it('pause right before document_importer and start again right after it', () => {
		const importer = script.indexOf('paperless-manage document_importer');
		expect(script.lastIndexOf('pause_helpers ||', importer)).toBeGreaterThan(script.lastIndexOf('[ "$count" = 0 ]', importer));
		expect(script.indexOf('resume_helpers', importer)).toBe(script.indexOf('\n', importer) + 1);
		expect(fn('cleanup')).toContain('resume_helpers');
		expect(script).toMatch(/\[ "\$cmd" = run \] && trap cleanup EXIT/);
	});

	it('start again once after an import that worked', () => {
		expect(run({})).toEqual({ out: 'imported', docker: ['stop tika gotenberg', 'start gotenberg tika'] });
	});

	it('start again after an import that failed (the EXIT trap)', () => {
		expect(run({ importFails: true }).docker).toEqual(['stop tika gotenberg', 'start gotenberg tika']);
	});

	it('are not started by the restore when it could not pause them', () => {
		expect(run({ dockerFails: true })).toEqual({ out: 'not paused\nimported', docker: ['stop tika gotenberg'] });
	});
});

describe('the memory figures in restore.json', { timeout: 30_000 }, () => {
	it('are valid JSON in every outcome, with the OOM kills since the start', () => {
		const sh = [fn('meminfo'), fn('oomkills'), 'mem_start="$(meminfo | cut -d" " -f1)"; mem_import=""', 'oom_start="$(oomkills)"', fn('memory'), 'printf "{\\"status\\":\\"failed\\"%s}" "$(memory)"'].join('\n');
		const r = spawnSync('sh', ['-c', sh, 'sh', 'run'], { encoding: 'utf8' });
		const m = JSON.parse(r.stdout).memory;
		expect(Object.keys(m)).toEqual(['availableMiBAtStart', 'availableMiBBeforeImport', 'availableMiBNow', 'swapMiB', 'swapUsedMiB', 'oomKills']);
		expect(m.availableMiBBeforeImport).toBeNull();
		expect(m.oomKills).toBe(0);
		for (const k of ['availableMiBAtStart', 'availableMiBNow', 'swapMiB', 'swapUsedMiB']) expect(Number.isInteger(m[k])).toBe(true);
	});

	it('go into the failure and the done outcome, and leave the script\'s arguments alone', () => {
		expect(fn('fail')).toContain('$(memory)"');
		expect(script).toMatch(/^status done ".*\$\(memory\)"$/m);
		const top = script.slice(0, script.indexOf('\ncmd="${1:-run}"'));
		expect(top.replace(/^[a-z_]+\(\) \{[\s\S]*?^\}/gm, '')).not.toMatch(/^set -- /m);
	});
});

describe('the swap', () => {
	it('is a file on the sealed area, made after the area is mounted, never on the rootfs', () => {
		const at = disk.indexOf('swap="$mnt/swapfile"');
		expect(at).toBeGreaterThan(disk.indexOf('mount /dev/mapper/sealed "$mnt"'));
		expect(disk.slice(at)).toMatch(/swapon "\$swap"/);
		expect(disk).not.toMatch(/swapon (?!"\$swap")/);
		// A guest that cannot swap starts as before.
		expect(disk.slice(at, disk.indexOf('report encrypted', at))).toContain('going on without');
	});
});
