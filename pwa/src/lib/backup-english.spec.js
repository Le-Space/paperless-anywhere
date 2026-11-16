// The backup area, the balances and the helper modules in English: the same
// functions answer in the app's language, with its numbers and file names.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setLang } from './i18n/index.js';
import { relayList } from './attest-p2p.js';
import { BackupFetchError, openSink } from './backup-fetch.js';
import { backupConfigFor, backupFacts, selfRestoreGuide } from './backups.js';
import { amount, duration } from './balances.js';
import { money } from './prices.js';
import { pickProviders, sharedWarnings } from './providers.js';
import { checkManifest, RUNTIME } from './runtime-pin.js';
import { storageView } from './storage.js';

const PIECE = 'bafkzcibexampleexampleexampleexampleexampleexampleexampleexample1234';
const backup = { pieceCid: PIECE, copies: [{ retrievalUrl: `https://provider-a.example.com/piece/${PIECE}` }] };
const provider = (id, more = {}) => ({ id, name: `P${id}`, location: '', place: 'DE, Musterstadt', country: 'DE', operator: `op${id}.example.com`, endorsed: false, active: true, ...more });

beforeAll(() => setLang('en'));
afterAll(() => setLang('de'));

describe('in English', () => {
	it('writes the guide for fetching a backup, with English file names', () => {
		const guide = selfRestoreGuide(backup);
		expect(guide.filename).toBe(`fetch-backup-yourself-${PIECE.slice(-12)}.txt`);
		expect(guide.text).toContain('Fetch a backup yourself – Paperless anywhere');
		expect(guide.text).toContain(`curl -fL -o backup.age 'https://provider-a.example.com/piece/${PIECE}'`);
		expect(guide.text).toContain('age -d -i key.txt backup.age > paperless-export.zip');
		expect(guide.text).toContain('2. Decrypt:');
		expect(guide.text).not.toMatch(/[äöüß„]|schluessel|sicherung/i);
	});

	it('names what keeps a backup configuration or a fetch from working', async () => {
		expect(() => backupConfigFor('calibration', 'not-a-key')).toThrow('No backup without an age key.');
		expect(backupFacts({ oomKills: 2, memAvailableBytes: 1.5e9, exit: 137 })).toEqual(['Memory ran out: the system ended 2 processes.', 'Free memory afterwards: 1.5 GB, no swap', 'Exit code 137']);
		const refused = await openSink({ suggestedName: 'a.zip', total: null, picker: undefined }).catch((e) => e);
		expect(refused).toBeInstanceOf(BackupFetchError);
		expect(refused.message).toBe('This backup is too large to hold in memory in this browser.');
	});

	it('says where copies cannot go and when they are not independent', () => {
		expect(pickProviders([provider(1)], { providerIds: [1, 2] }).problems).toEqual(['Provider 2 is not approved (any more).']);
		expect(pickProviders([provider(1)], { copies: 2 }).problems).toEqual(['2 copies wanted, the region has only 1 approved provider.']);
		expect(sharedWarnings([provider(1), provider(2, { operator: 'op1.example.com' })])).toEqual(['P1 and P2 belong to the same operator (domain example.com).']);
	});

	it('writes storage, amounts, durations and money the English way', () => {
		expect(storageView(6.5e9, 'running')?.text).toBe('6.5 GB of 8.0 GB');
		expect(storageView(6.5e9, 'running')?.hint).toBe('1.5 GB still free. When it gets tight, the backups fail first.');
		expect(amount(1234.5)).toBe('1,234.5');
		expect(amount(1234.5, 2, 'de')).toBe('1.234,5');
		expect(duration(76)).toBe('3 days 4 h');
		const prices = { alephUsd: 0.05, alephEur: 0.045, usdEur: 0.9, at: 0 };
		expect(money(1_500_000, 'eur', prices)).toBe('≈ €1.35');
		expect(money(1_500_000, 'usd', prices)).toBe('≈ $1.50');
		expect(money(1_500_000, 'eur', prices, 'de')).toBe('≈ 1,35 €');
	});

	it('refuses a relay or a runtime it does not know, in words', () => {
		expect(() => relayList('https://relay.example.com')).toThrow('Not a relay: https://relay.example.com (expected: wss://<host>/attest or a multiaddr with /p2p/)');
		expect(() => checkManifest({ bundle: { sha256: 'other' } }, RUNTIME)).toThrow('The runtime Aleph delivers is not the one this app knows (another bundle). Nothing was started.');
	});
});
