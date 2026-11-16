// The restore's download limit (rootfs/files/paperless-restore, max_bytes):
// a part exactly as large as the backup tool makes them must not fail on it.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../../../rootfs/files/paperless-restore', import.meta.url), 'utf8');
const fn = script.match(/^max_bytes\(\) \{[\s\S]*?^\}/m)?.[0];
const limit = (size) => Number(spawnSync('sh', ['-c', `${fn}\nmax_bytes "$1"`, 'sh', size], { encoding: 'utf8' }).stdout.trim());

describe('the restore download limit', { timeout: 30_000 }, () => {
	it('is the named size plus 1 % and 1 MiB', () => {
		expect(fn).toBeTruthy();
		expect(limit('1000000000')).toBe(1_000_000_000 + 10_000_000 + 1_048_576);
		expect(limit('47325')).toBe(47_325 + 473 + 1_048_576);
	});
	it('leaves room above a full part when the ledger names no size', () => {
		for (const s of ['', '-', 'abc']) expect(limit(s)).toBe(1_100_000_000);
	});
	it('takes a part of the tool\'s full size, and a little more, in the ledger check', () => {
		expect(script).toMatch(/0 < psize <= 1_100_000_000/);
		expect(script).not.toMatch(/--max-filesize 1000000000/);
	});
});
