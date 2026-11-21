import { describe, expect, it } from 'vitest';
import { Encrypter, generateX25519Identity, identityToRecipient } from 'age-encryption';
import { checkBackupHeader } from './backup-header.js';

// Made up: no real piece CID; fresh keys for each run.
const CID = 'bafkzcibmadeuppiece';
const entry = (urls) => ({ pieceCid: CID, copies: urls.map((u) => ({ retrievalUrl: u })) });
const sealed = async (recipient) => {
	const e = new Encrypter();
	e.addRecipient(recipient);
	return e.encrypt(new Uint8Array(200_000).fill(7));
};
/** A provider that serves `bytes`, counting what it was asked for. */
const serving = (bytes, seen = []) => async (url) => {
	seen.push(url);
	if (bytes === null) return new Response(null, { status: 404 });
	return new Response(new Blob([bytes]).stream(), { status: 200 });
};

describe('the backup header check', () => {
	it('opens a backup sealed to the identity, from its first bytes only', async () => {
		const identity = await generateX25519Identity();
		const file = await sealed(await identityToRecipient(identity));
		const seen = [];
		expect(await checkBackupHeader({ backup: entry([`https://sp1.example/piece/${CID}`]), identity, fetchImpl: serving(file, seen) })).toBe('opens');
		expect(seen).toEqual([`https://sp1.example/piece/${CID}`]);
	});

	it('refuses a backup sealed to another key, and a damaged header', async () => {
		const identity = await generateX25519Identity();
		const other = await identityToRecipient(await generateX25519Identity());
		const url = [`https://sp1.example/piece/${CID}`];
		expect(await checkBackupHeader({ backup: entry(url), identity, fetchImpl: serving(await sealed(other)) })).toBe('refused');
		const file = await sealed(await identityToRecipient(identity));
		const text = new TextDecoder().decode(file.subarray(0, 300));
		const mac = text.indexOf('--- ') + 6;
		file[mac] = file[mac] === 65 ? 66 : 65;
		expect(await checkBackupHeader({ backup: entry(url), identity, fetchImpl: serving(file) })).toBe('refused');
	});

	it('tries the next copy when one does not answer, and says when none did', async () => {
		const identity = await generateX25519Identity();
		const file = await sealed(await identityToRecipient(identity));
		const urls = [`https://sp1.example/piece/${CID}`, `https://sp2.example/piece/${CID}`];
		const fetchImpl = async (url) => (url.includes('sp1') ? new Response(null, { status: 502 }) : serving(file)(url));
		expect(await checkBackupHeader({ backup: entry(urls), identity, fetchImpl })).toBe('opens');
		expect(await checkBackupHeader({ backup: entry(urls), identity, fetchImpl: serving(null) })).toBe('unreachable');
		// Never anything but a provider's piece address.
		expect(await checkBackupHeader({ backup: entry(['http://sp1.example/x']), identity, fetchImpl: serving(file) })).toBe('unreachable');
	});

	// An incremental backup: the public prefix, then the age stream (snapshots.js).
	const pack = async (recipient, gen, seq) => {
		const prefix = new TextEncoder().encode(`PA-SNAP/1 ${gen} ${seq}`.padEnd(63, ' ') + '\n');
		const body = await sealed(recipient);
		const out = new Uint8Array(prefix.length + body.length);
		out.set(prefix);
		out.set(body, prefix.length);
		return out;
	};

	it('opens a pack behind its public prefix (2026-11-21: every pack read as refused)', async () => {
		const identity = await generateX25519Identity();
		const gen = 'ab'.repeat(8);
		const file = await pack(await identityToRecipient(identity), gen, 3);
		const url = [`https://sp1.example/piece/${CID}`];
		expect(await checkBackupHeader({ backup: { ...entry(url), kind: 'snapshot', gen, seq: 3 }, identity, fetchImpl: serving(file) })).toBe('opens');
		// Without what the VM said of it, the prefix alone decides.
		expect(await checkBackupHeader({ backup: entry(url), identity, fetchImpl: serving(file) })).toBe('opens');
	});

	it('refuses a pack sealed to another key, and one that is not the pack the VM reported', async () => {
		const identity = await generateX25519Identity();
		const gen = 'ab'.repeat(8);
		const url = [`https://sp1.example/piece/${CID}`];
		const other = await pack(await identityToRecipient(await generateX25519Identity()), gen, 3);
		expect(await checkBackupHeader({ backup: { ...entry(url), kind: 'snapshot', gen, seq: 3 }, identity, fetchImpl: serving(other) })).toBe('refused');
		const own = await pack(await identityToRecipient(identity), gen, 3);
		expect(await checkBackupHeader({ backup: { ...entry(url), kind: 'snapshot', gen, seq: 4 }, identity, fetchImpl: serving(own) })).toBe('refused');
		expect(await checkBackupHeader({ backup: { ...entry(url), kind: 'snapshot', gen: 'cd'.repeat(8), seq: 3 }, identity, fetchImpl: serving(own) })).toBe('refused');
	});
});
