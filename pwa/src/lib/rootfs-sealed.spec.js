// The VM writes secrets, restored backups and certificates only onto the
// sealed data area (rootfs/files/paperless-require-sealed). Run here with a
// stand-in for paperless-data-disk and a temporary state directory.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('../../../rootfs/files/paperless-require-sealed', import.meta.url).pathname;
const files = new URL('../../../rootfs/files/', import.meta.url).pathname;

function run(status) {
	const dir = mkdtempSync(join(tmpdir(), 'sealed-'));
	const disk = join(dir, 'data-disk');
	writeFileSync(disk, '#!/bin/sh\nexit 0\n');
	chmodSync(disk, 0o755);
	if (status) writeFileSync(join(dir, 'data-disk.json'), JSON.stringify({ status, reason: 'x', bytes: 0, seconds: 0, probe: null }).replace(/,/g, ','));
	return spawnSync('sh', [script, 'paperless-test'], { env: { ...process.env, PAPERLESS_STATE: dir, PAPERLESS_DATA_DISK: disk }, encoding: 'utf8' });
}

describe('the sealed data area', () => {
	it('lets a script go on when the area is sealed', () => {
		expect(run('encrypted').status).toBe(0);
	});
	it('stops a script when the area could not be made, or is not known', () => {
		for (const s of ['plain', null]) {
			const r = run(s);
			expect(r.status).toBe(1);
			expect(r.stderr).toContain('paperless-test: no sealed data area');
		}
	});
	it('is required by every script that writes secrets, a restored backup or certificates', () => {
		for (const name of ['paperless-secrets', 'paperless-restore', 'paperless-fixed-address', 'paperless-stack-up']) {
			expect(readFileSync(join(files, name), 'utf8')).toMatch(/paperless-require-sealed/);
		}
	});
	it('makes paperless-data-disk fail when the area is not sealed, and move rather than copy', () => {
		const disk = readFileSync(join(files, 'paperless-data-disk'), 'utf8');
		expect(disk).toMatch(/report plain "\$1"\n\s*exit 1/);
		expect(disk).not.toMatch(/cp -a/);
	});
});
