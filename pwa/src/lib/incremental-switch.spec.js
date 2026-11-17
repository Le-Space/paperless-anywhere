// The switch for incremental backups: saved with the backup places, kept when
// the config is rebuilt, and handed to the VM in backup_config. Made-up keys.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { backupConfigFor, vmBackupSecrets } from './backups.js';

const recipient = `age1${'q'.repeat(58)}`;
const places = (enabled) => ({ copies: 2, providerIds: [], regions: ['EU'], incremental: { enabled } });

describe('the incremental switch', () => {
	it('is off by default and when unticked, on when ticked', () => {
		expect(backupConfigFor('calibration', recipient).incremental).toBeUndefined();
		expect(backupConfigFor('calibration', recipient, places(false)).incremental).toBeUndefined();
		expect(backupConfigFor('mainnet', recipient, places(true)).incremental).toEqual({ enabled: true });
	});

	it('stays on when the config is rebuilt from itself (another age key)', () => {
		const on = backupConfigFor('calibration', recipient, places(true));
		expect(backupConfigFor('calibration', `age1${'p'.repeat(58)}`, on).incremental).toEqual({ enabled: true });
	});

	it('reaches the VM on the wallet path and through Le Space Credits', () => {
		const backupConfig = backupConfigFor('calibration', recipient, places(true));
		const wallet = vmBackupSecrets({ network: 'calibration', backupConfig, payer: `0x${'a'.repeat(40)}` }, { sessionKey: '0x01' });
		expect(JSON.parse(wallet.backup_config).incremental).toEqual({ enabled: true });
		const credits = vmBackupSecrets(
			{ network: 'calibration', backupConfig, backupsByCredits: true },
			{ backupKey: '0x02', creditsUrl: 'https://credits.example', product: 'paperless-anywhere', account: `0x${'b'.repeat(40)}`, signer: { payer: `0x${'c'.repeat(40)}`, signer: `0x${'d'.repeat(40)}`, tag: 'made-up-tag', label: 'paperless-backup-test', network: 'calibration' } }
		);
		expect(JSON.parse(credits.backup_config).incremental).toEqual({ enabled: true });
	});

	it('is saved together with the places, so saving them never drops it', () => {
		const src = readFileSync(new URL('./BackupPlaces.svelte', import.meta.url), 'utf8');
		expect(src).toMatch(/incremental: \{ enabled: incremental \}/);
		expect(src).toMatch(/data-testid="places-incremental"/);
		expect(src).toMatch(/let incremental = \$state\(config\.incremental\?\.enabled === true\)/);
	});
});
