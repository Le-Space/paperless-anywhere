// What an image says it can do (rootfs/files/capabilities.json, installed by
// build-image.sh, reported by paperless-status and the rootfs build). The app
// will decide by it instead of hash lists, so every claim must hold for the
// scripts in this image: each one is checked here against them.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const file = (/** @type {string} */ p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const caps = JSON.parse(file('rootfs/files/capabilities.json'));
const restore = file('rootfs/files/paperless-restore');
const disk = file('rootfs/files/paperless-data-disk');
const build = file('rootfs/build-image.sh');
const status = file('rootfs/files/paperless-status');

describe('the image’s capabilities', () => {
	it('names only what is checked here, in version 1', () => {
		expect(caps).toEqual({ v: 1, fullPart: true, incremental: 'pa-snap-1', restoreUnmarked: true, restoreMemory: true, helpersPausedForImport: true, autoStop: 1, selfForget: 1 });
	});

	it('fullPart: the restore takes a part of 1,000,000,000 bytes and more (9d2da9b)', () => {
		expect(restore).toMatch(/^max_bytes\(\) \{/m);
		expect(restore).toContain('--max-filesize "$limit"');
	});

	it('incremental pa-snap-1: the backup tool from f4df5d7 (PA-SNAP/1 prefix)', () => {
		expect(build).toMatch(/^BACKUP_TOOL_COMMIT=f4df5d78ac3d364460a018430a1c9cfceccae7ab$/m);
		expect(restore).toContain('restore-snapshot');
	});

	it('restoreUnmarked: the choice is read before the secrets are forgotten (c56768c)', () => {
		const fetchBody = restore.slice(restore.indexOf('\nfetch() {'));
		expect(fetchBody.indexOf('restore_unmarked')).toBeLessThan(fetchBody.search(/^\s*forget_secrets$/m));
	});

	it('restoreMemory, helpersPausedForImport (#403)', () => {
		expect(restore).toMatch(/status done ".*\$\(memory\)"$/m);
		expect(restore).toContain('pause_helpers ||');
	});

	it('autoStop 1: paperless-stop asks paperless-auto-stop, installed with tzdata (docs/auto-stop.md)', () => {
		expect(file('rootfs/files/paperless-stop')).toContain('request="$(paperless-auto-stop 2>/dev/null || true)"');
		expect(build).toMatch(/\bpaperless-auto-stop\b/);
		expect(build).toMatch(/--include=[^ ]*\btzdata\b/);
		expect(status).toContain('"idle", "schedule"');
	});

	it('does not claim swap, and the image sets none up: the guest kernel has none', () => {
		// 2026-11-21: swapon ended in "Function not implemented" on the VM.
		expect(caps).not.toHaveProperty('swap');
		const code = disk.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
		expect(code).not.toMatch(/swapon|mkswap|swapfile|swapMiB|swapError/);
	});

	it('is installed read-only outside what the data area takes over, and reported', () => {
		expect(build).toContain('install -D -m 644 "$here/files/capabilities.json" "$root/usr/share/paperless-anywhere/capabilities.json"');
		expect(disk).not.toMatch(/\/usr\/share\/paperless-anywhere/);
		expect(status).toContain('"capabilities": capabilities');
	});
});
