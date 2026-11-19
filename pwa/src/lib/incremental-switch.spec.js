// The switch for incremental backups: saved with the backup places, kept when
// the config is rebuilt, and handed to the VM in backup_config. Made-up keys.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { INCREMENTAL_IMAGES, backupConfigFor, supportsIncremental, vmBackupSecrets } from './backups.js';

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

	it('reaches the VM only with an image that makes incremental backups, on both payment paths', () => {
		const backupConfig = backupConfigFor('calibration', recipient, places(true));
		const ready = 'a'.repeat(64);
		const images = [ready];
		const wallet = (plain) => vmBackupSecrets({ network: 'calibration', backupConfig, payer: `0x${'a'.repeat(40)}`, ownImage: { plainSha256: plain } }, { sessionKey: '0x01', incrementalImages: images });
		expect(JSON.parse(wallet(ready).backup_config).incremental).toEqual({ enabled: true });
		// An older image: the switch is left out, the VM keeps making full backups.
		expect(JSON.parse(wallet('b'.repeat(64)).backup_config).incremental).toBeUndefined();
		expect(JSON.parse(wallet(undefined).backup_config).incremental).toBeUndefined();
		const credits = vmBackupSecrets(
			{ network: 'calibration', backupConfig, backupsByCredits: true, ownImage: { plainSha256: ready } },
			{ backupKey: '0x02', creditsUrl: 'https://credits.example', product: 'paperless-anywhere', account: `0x${'b'.repeat(40)}`, signer: { payer: `0x${'c'.repeat(40)}`, signer: `0x${'d'.repeat(40)}`, tag: 'made-up-tag', label: 'paperless-backup-test', network: 'calibration' }, incrementalImages: images }
		);
		expect(JSON.parse(credits.backup_config).incremental).toEqual({ enabled: true });
	});

	it('the images of 2026-11-17 and 2026-11-18 (backup tool f4df5d7) make them; older images keep the switch greyed out', () => {
		expect(INCREMENTAL_IMAGES).toEqual(['cce108fdbcda36dfe1e6824567bb8400274de60c8aee96b06234347a9e756fd2', '36c034033e663d153447396b75faee56a513811f3e01ad03f243c173bdfe65b3', '1657c6a5ad6480f59c66e1e03841905e6ed0627b6c16da3d0c8c8d24c4bbd0ac']);
		expect(supportsIncremental({ ownImage: { plainSha256: '36c034033e663d153447396b75faee56a513811f3e01ad03f243c173bdfe65b3' } })).toBe(true);
		expect(supportsIncremental({ ownImage: { plainSha256: '1657c6a5ad6480f59c66e1e03841905e6ed0627b6c16da3d0c8c8d24c4bbd0ac' } })).toBe(true);
		expect(supportsIncremental({ ownImage: { plainSha256: 'f08aeec9d1d37bb9a79e4cbe8d7614d58dadca0b527fb4027503313a02610753' } })).toBe(false);
		expect(supportsIncremental({})).toBe(false);
		expect(supportsIncremental({ ownImage: { plainSha256: 'c'.repeat(64) } }, ['c'.repeat(64)])).toBe(true);
		const src = readFileSync(new URL('./BackupPlaces.svelte', import.meta.url), 'utf8');
		expect(src).toMatch(/disabled=\{busy \|\| \(!incrementalReady && !incremental\)\}/);
		expect(src).toMatch(/data-testid="places-incremental-later"/);
		expect(readFileSync(new URL('./Setup.svelte', import.meta.url), 'utf8')).toMatch(/incrementalReady=\{supportsIncremental\(profile\)\}/);
	});

	it('is saved together with the places, so saving them never drops it', () => {
		const src = readFileSync(new URL('./BackupPlaces.svelte', import.meta.url), 'utf8');
		expect(src).toMatch(/incremental: \{ enabled: incremental \}/);
		expect(src).toMatch(/data-testid="places-incremental"/);
		expect(src).toMatch(/let incremental = \$state\(config\.incremental\?\.enabled === true\)/);
	});
});
