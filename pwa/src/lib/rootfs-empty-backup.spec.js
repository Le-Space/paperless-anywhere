// No backup of an empty Paperless (rootfs/files/paperless-backup): its backup
// would become the newest and push real ones out of retention. The check is
// run here with sh and python3 on made-up fingerprints.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stopPanel } from './stop-panel.js';
import { BACKUP_TEXTS } from './backup-overview.js';

const script = readFileSync(new URL('../../../rootfs/files/paperless-backup', import.meta.url), 'utf8');
const fn = script.match(/^empty_now\(\) \{[\s\S]*?; \}$/m)?.[0];
const empty = (fp) => spawnSync('sh', ['-c', `${fn}\nnow="$1"; empty_now`, 'sh', JSON.stringify(fp)]).status === 0;

describe('the VM skips an empty Paperless', () => {
	it('finds the check, before the backup runs, and maps the tool\'s exit 3', () => {
		expect(fn).toBeTruthy();
		expect(script.indexOf('if empty_now; then')).toBeLessThan(script.indexOf('status running'));
		expect(script).toMatch(/if \[ "\$rc" -eq 3 \]; then\n\s+status empty/);
	});
	it('is empty only without documents and without any in the trash', () => {
		expect(empty({ documents: 0, trash: 0, notes: 0 })).toBe(true);
		expect(empty({ documents: 1, trash: 0 })).toBe(false);
		expect(empty({ documents: 0, trash: 3 })).toBe(false);
		expect(spawnSync('sh', ['-c', `${fn}\nnow='not json'; empty_now`]).status).not.toBe(0);
	});
	it('a stop whose backup found Paperless empty is over, with no new backup', () => {
		const rows = stopPanel({ kind: 'stop', sent: true, status: { stop: { status: 'ready', backup: { status: 'empty' } } } });
		expect(JSON.stringify(rows)).toContain('skipped');
	});
	it('says so in both languages', () => {
		expect(BACKUP_TEXTS.de.checkOutcome('empty')).toBe('Paperless ist leer, nichts gesichert');
		expect(BACKUP_TEXTS.en.doneEmpty).toMatch(/no documents/);
	});
});
