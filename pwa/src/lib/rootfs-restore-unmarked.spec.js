// A backup without the vault's mark, restored because the person chose that
// very piece (rootfs/files/paperless-restore): the VM must still know the
// choice when it checks the mark. forget_secrets removes restore_unmarked
// right after the decryption, so the choice is read before that
// (2026-11-18: read after it, every such backup was refused as "missing").
// The script's own lines run here with sh on made-up files.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = readFileSync(new URL('../../../rootfs/files/paperless-restore', import.meta.url), 'utf8');
const forget = script.match(/^forget_secrets\(\) \{[\s\S]*?^\}/m)?.[0];
const read = script.match(/^unmarked="\$\(tr -cd 'a-z0-9' < "\$secrets\/restore_unmarked".*$/m)?.[0];
const check = script.match(/^if \[ "\$mark" != verified \]; then[\s\S]*?^fi$/m)?.[0];
const fetchBody = script.slice(script.indexOf('\nfetch() {'));
const CID = 'bafkzcibmadeupmadeupmadeupmadeup';

/** The script's order: the choice is read, the secrets forgotten, the mark checked. */
function run({ mark, chosen }) {
	const dir = mkdtempSync(join(tmpdir(), 'restore-unmarked-'));
	if (chosen) writeFileSync(join(dir, 'restore_unmarked'), chosen + '\n');
	const sh = [
		`secrets='${dir}'; work='${dir}/work'; cid='${CID}'; mark='${mark}'`,
		'fail() { echo "FAIL: $*"; exit 1; }',
		forget,
		read,
		'forget_secrets',
		check,
		'echo "OK: $mark"; [ -e "$secrets/restore_unmarked" ] && echo "file still there"'
	].join('\n');
	return spawnSync('sh', ['-c', sh], { encoding: 'utf8' }).stdout.trim();
}

describe('restoring a backup without the vault\'s mark', () => {
	it('finds the script\'s lines', () => {
		expect(forget).toContain('restore_unmarked');
		expect(read).toBeTruthy();
		expect(check).toContain('mark=accepted');
	});

	it('reads the choice in fetch before the secrets are forgotten, and not again at the check', () => {
		const at = fetchBody.indexOf(read);
		expect(at).toBeGreaterThan(0);
		const firstForget = fetchBody.search(/^\s*forget_secrets$/m);
		expect(firstForget).toBeGreaterThan(at);
		expect(check).not.toContain('restore_unmarked');
	});

	it('takes the chosen piece without a mark, after the secrets are gone', () => {
		expect(run({ mark: 'missing', chosen: CID })).toBe('OK: accepted');
	});

	it('refuses it when another piece was chosen, or none', () => {
		expect(run({ mark: 'missing', chosen: 'bafkzcibanotheranotheranotherano' })).toBe("FAIL: the backup does not carry this vault's mark (missing)");
		expect(run({ mark: 'missing', chosen: '' })).toBe("FAIL: the backup does not carry this vault's mark (missing)");
	});

	it('refuses another vault\'s or a broken mark even for the chosen piece; a verified one needs no choice', () => {
		expect(run({ mark: 'invalid', chosen: CID })).toBe("FAIL: the backup does not carry this vault's mark (invalid)");
		expect(run({ mark: 'verified', chosen: '' })).toBe('OK: verified');
	});
});
