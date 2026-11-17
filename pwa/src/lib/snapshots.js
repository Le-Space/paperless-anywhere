// Incremental backups (paperless-backup-filecoin's snapshot.mjs): each backup
// is a pack, one piece (a baseline above 1 GB in parts), with public piece
// metadata pa = "snap/1" (or "snap/1 2/3" for part 2 of 3), gen (16 hex, the
// generation) and seq (0 = the generation's baseline). A snapshot is restored
// from every pack of its generation up to its own.
//
// Warm Storage keeps piece metadata in its storage without a getter in its
// view contract; it is read here as the tool reads it (piece-metadata.mjs):
// with extsload, at the slot of dataSetPieceMetadata (13) for the data set,
// piece and key.

import { encodeAbiParameters, encodePacked, hexToBytes, keccak256, parseAbi, toHex } from 'viem';

export const PIECE_METADATA_SLOT = 13n;
const KEYS = ['pa', 'gen', 'seq'];
const ABI = parseAbi(['function extsload(bytes32 slot) view returns (bytes32)', 'function extsloadStruct(bytes32 slot, uint256 size) view returns (bytes32[])']);
const decoder = new TextDecoder();

/** The storage slot of one piece's metadata value for `key`. */
export function pieceMetadataSlot(dataSetId, pieceId, key) {
	const dataSetLevel = keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [BigInt(dataSetId), PIECE_METADATA_SLOT]));
	const pieceLevel = keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes32' }], [BigInt(pieceId), dataSetLevel]));
	return keccak256(encodePacked(['string', 'bytes32'], [key, pieceLevel]));
}

/**
 * A Solidity string from its slot word; long ones from the words at keccak256(slot).
 * @param {`0x${string}`} word @param {`0x${string}`} slot @param {(slot: `0x${string}`, n: number) => Promise<readonly `0x${string}`[]>} [readLong]
 */
export async function decodeStringSlot(word, slot, readLong) {
	const w = BigInt(word);
	if ((w & 1n) === 0n) {
		const len = Number((w & 0xffn) >> 1n);
		if (len > 31) throw new Error('not a string slot');
		return decoder.decode(hexToBytes(toHex(w, { size: 32 })).subarray(0, len));
	}
	const len = Number(w >> 1n);
	if (len > 4096) throw new Error('metadata value too long');
	if (!readLong) throw new Error('a long value needs extsloadStruct');
	const words = await readLong(keccak256(slot), Math.ceil(len / 32));
	const bytes = new Uint8Array(words.length * 32);
	words.forEach((x, i) => bytes.set(hexToBytes(x), i * 32));
	return decoder.decode(bytes.subarray(0, len));
}

/**
 * A piece's snapshot metadata, or null for a piece of the old kind (a full
 * backup) or anything malformed.
 * @param {Record<string, string> | null | undefined} meta
 * @returns {{ gen: string, seq: number, part: number, parts: number } | null}
 */
export function parseSnapshotMeta(meta) {
	const m = /^snap\/1(?: (\d{1,4})\/(\d{1,4}))?$/.exec(String(meta?.pa ?? ''));
	if (!m) return null;
	const gen = String(meta?.gen ?? '');
	const seq = Number(meta?.seq);
	if (!/^[0-9a-f]{16}$/.test(gen) || !Number.isSafeInteger(seq) || seq < 0 || String(seq) !== String(meta?.seq)) return null;
	const parts = m[2] ? Number(m[2]) : 1;
	const part = m[1] ? Number(m[1]) - 1 : 0;
	if (parts < 1 || part < 0 || part >= parts) return null;
	return { gen, seq, part, parts };
}

/**
 * The snapshot metadata of a data set's pieces, read with plain calls.
 * @param {any} client viem public client @param {`0x${string}`} fwss Warm Storage
 * @param {bigint | string} dataSetId @param {Array<bigint | string | number>} pieceIds
 * @returns {Promise<Map<string, { gen: string, seq: number, part: number, parts: number } | null>>}
 */
export async function readSnapshotMeta(client, fwss, dataSetId, pieceIds) {
	const calls = pieceIds.flatMap((id) => KEYS.map((key) => ({ id: String(id), key, slot: pieceMetadataSlot(dataSetId, id, key) })));
	const words = await Promise.all(calls.map((c) => client.readContract({ address: fwss, abi: ABI, functionName: 'extsload', args: [c.slot] })));
	const readLong = (slot, n) => client.readContract({ address: fwss, abi: ABI, functionName: 'extsloadStruct', args: [slot, BigInt(n)] });
	/** @type {Map<string, Record<string, string>>} */
	const raw = new Map();
	for (const [i, c] of calls.entries()) {
		const value = await decodeStringSlot(words[i], c.slot, readLong);
		const m = raw.get(c.id) ?? {};
		if (value) m[c.key] = value;
		raw.set(c.id, m);
	}
	return new Map([...raw].map(([id, m]) => [id, parseSnapshotMeta(m)]));
}

/**
 * The snapshots the data sets hold. A pack is all its parts in one data set;
 * a data set can restore a snapshot only with every pack of its generation up
 * to it. Each snapshot carries `packs` (what paperless-restore fetches: every
 * pack up to it, with each holding data set's URLs).
 * @param {Array<{ providerId: any, dataSetId?: any, pieces: Array<{ cid: any, id: any, snapshot?: any }> }>} sets
 * @param {{ urlOf: (providerId: any) => string | undefined, placeOf?: (providerId: any) => string, sizeOf: (cid: string) => number | null, cidText: (cid: any) => string }} o
 */
export function snapshotsFromPieces(sets, { urlOf, placeOf = () => '', sizeOf, cidText }) {
	/** @type {Map<string, { gen: string, seq: number, parts: number, cids: string[], holders: any[], order: number }>} */
	const packs = new Map();
	/** data set id → keys of the packs it holds whole */
	const whole = new Map();
	/** data set id → the snapshot keys in piece-id order (for chainOrder) */
	const sequences = [];
	for (const ds of sets) {
		const id = String(ds.dataSetId);
		const here = new Map();
		for (const p of ds.pieces) {
			if (!p.snapshot) continue;
			const k = `${p.snapshot.gen}/${p.snapshot.seq}`;
			here.set(k, [...(here.get(k) ?? []), p]);
		}
		const full = new Set();
		const seq = [];
		for (const [k, ps] of [...here].sort((a, b) => Number(BigInt(a[1][0].id) - BigInt(b[1][0].id)))) {
			const { gen, seq: n, parts } = ps[0].snapshot;
			const pack = packs.get(k) ?? { gen, seq: n, parts, cids: [], holders: [], order: 0 };
			const sorted = [...ps].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
			for (const p of sorted) pack.cids[p.snapshot.part] ??= cidText(p.cid);
			pack.order = Math.max(pack.order, Number(sorted.at(-1).id));
			const isWhole = new Set(ps.map((p) => p.snapshot.part)).size === parts;
			if (isWhole) {
				full.add(k);
				pack.holders.push({ providerId: ds.providerId, dataSetId: ds.dataSetId, pieceIds: sorted.map((p) => String(p.id)) });
			}
			packs.set(k, pack);
			seq.push(`snap:${k}`);
		}
		whole.set(id, full);
		sequences.push(seq);
	}
	const copyOf = (pack, h) => {
		const base = urlOf(h.providerId);
		if (!base) return null;
		const urls = pack.cids.map((c) => `${base}/piece/${c}`);
		return {
			providerId: String(h.providerId),
			retrievalUrl: urls[0],
			retrievalUrls: urls,
			place: placeOf(h.providerId),
			...(h.dataSetId != null ? { dataSetId: String(h.dataSetId), pieceIds: h.pieceIds } : {})
		};
	};
	const snapshots = [];
	for (const [k, pack] of packs) {
		if (pack.cids.length !== pack.parts || pack.cids.some((c) => !c)) continue;
		const chain = Array.from({ length: pack.seq + 1 }, (_, i) => packs.get(`${pack.gen}/${i}`));
		const restorable = chain.every(Boolean)
			? pack.holders.filter((h) => chain.every((p) => whole.get(String(h.dataSetId))?.has(`${p.gen}/${p.seq}`)))
			: [];
		const sizes = pack.cids.map(sizeOf);
		snapshots.push({
			key: `snap:${k}`,
			kind: 'snapshot',
			gen: pack.gen,
			seq: pack.seq,
			pieceCid: pack.cids[0],
			...(pack.cids.length > 1 ? { parts: pack.cids.map((c, i) => ({ pieceCid: c, size: sizes[i] })) } : {}),
			size: sizes.every((n) => n != null) ? sizes.reduce((a, n) => a + n, 0) : null,
			copies: restorable.map((h) => copyOf(pack, h)).filter(Boolean),
			complete: restorable.length >= sets.length,
			order: pack.order,
			packs: chain.every(Boolean)
				? chain.map((p) => ({
						seq: p.seq,
						parts: p.cids.map((c) => ({ pieceCid: c, ...(sizeOf(c) != null ? { size: sizeOf(c) } : {}) })),
						copies: p.holders.map((h) => copyOf(p, h)).filter(Boolean).map((c) => ({ providerId: c.providerId, ...(c.dataSetId ? { dataSetId: c.dataSetId } : {}), retrievalUrls: c.retrievalUrls }))
					}))
				: []
		});
	}
	return { snapshots, sequences };
}

/**
 * What paperless-restore takes for a snapshot: its generation, its number and
 * every pack up to it with the URLs of the data sets that hold it.
 * @param {any} backup a snapshot as snapshotsFromPieces lists it
 */
export function snapshotRestoreEntry(backup) {
	return {
		kind: 'snapshot',
		name: `snapshot-${backup.gen.slice(0, 6)}-${backup.seq}`,
		pieceCid: backup.pieceCid,
		gen: backup.gen,
		seq: backup.seq,
		packs: backup.packs
	};
}
