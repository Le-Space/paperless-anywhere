// After a stop: does the backup that reached the providers open with this
// vault's backup key? The app reads the first bytes of the backup's first
// piece from a provider (the age header: who it is for, sealed with a MAC)
// and lets age unwrap the file key and check the header's MAC. Nothing else
// of the backup is read; the file key is dropped at once, and the identity
// goes to the age library only: no address, no header, no log, no DOM.
//
// An incremental backup (a pack) carries a public prefix of 64 bytes before
// the age stream (snapshots.js); it is skipped, after it named the pack the
// VM reported. 2026-11-21: without that, every pack read as "refused".
import { pieceSources } from './backups.js';
import { PREFIX_BYTES, classifyPrefix } from './snapshots.js';

/** Enough for an age v1 header with one X25519 recipient (about 200 bytes). */
const HEADER_BYTES = 4096 + PREFIX_BYTES;

/**
 * @param {{
 *   backup: any,
 *   identity: string,
 *   fetchImpl?: typeof fetch,
 *   age?: () => Promise<{ Decrypter: new () => { addIdentity(s: string): void, decryptHeader(h: Uint8Array): Promise<Uint8Array> } }>
 * }} a `backup`: the entry the VM reported (pieceCid, parts, copies)
 * @returns {Promise<'opens' | 'refused' | 'unreachable'>} `opens`: the header
 * opens with the identity and its MAC holds; `refused`: it does not (another
 * key, or a damaged header); `unreachable`: no provider gave its first bytes.
 */
export async function checkBackupHeader({ backup, identity, fetchImpl = fetch, age = () => import('age-encryption') }) {
	const urls = backup?.pieceCid && Array.isArray(backup.copies) ? (pieceSources(backup)[0]?.urls ?? []) : [];
	for (const url of urls) {
		const head = await firstBytes(url, fetchImpl).catch(() => null);
		if (!head) continue;
		const said = classifyPrefix(head);
		const pack = said && said !== 'full' ? said : null;
		// A pack other than the one the VM reported is not this backup.
		if (pack && backup.kind === 'snapshot' && (backup.gen !== pack.gen || Number(backup.seq) !== pack.seq)) return 'refused';
		const { Decrypter } = await age();
		const d = new Decrypter();
		d.addIdentity(identity);
		try {
			const fileKey = await d.decryptHeader(pack ? head.subarray(PREFIX_BYTES) : head);
			fileKey.fill(0);
			return 'opens';
		} catch {
			return 'refused';
		}
	}
	return 'unreachable';
}

/** The first bytes of a piece, then the rest is not fetched. @param {string} url @param {typeof fetch} fetchImpl */
async function firstBytes(url, fetchImpl) {
	const res = await fetchImpl(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
	if (!res.ok || !res.body) return null;
	const reader = res.body.getReader();
	const out = new Uint8Array(HEADER_BYTES);
	let n = 0;
	while (n < HEADER_BYTES) {
		const { done, value } = await reader.read();
		if (done) break;
		const take = Math.min(value.byteLength, HEADER_BYTES - n);
		out.set(value.subarray(0, take), n);
		n += take;
	}
	await reader.cancel().catch(() => {});
	return n ? out.subarray(0, n) : null;
}
