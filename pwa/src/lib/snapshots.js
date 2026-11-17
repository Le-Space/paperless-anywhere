// Incremental backups (paperless-backup-filecoin's snapshot.mjs): each backup
// is a pack, one piece (a baseline above 1 GB in parts). A sealed pack starts
// with a public prefix of 64 bytes, "PA-SNAP/1 <gen> <seq>" (gen: 16 hex, the
// generation; seq 0: its baseline), before the age stream; a full backup of
// the old kind starts with age's own header. A snapshot is restored from
// every pack of its generation up to its own.
//
// The prefix is read with an HTTP range request (bytes 0-63) from a provider
// that holds the piece. Warm Storage keeps piece metadata only in its
// PieceAdded event, not in its state, so the chain alone does not say it.

export const PREFIX_BYTES = 64;
const AGE_TAG = 'age-encryption.org/v1';
const decoder = new TextDecoder('latin1');

/**
 * What the first bytes of a piece say: a pack ({ gen, seq }), a full backup
 * ('full'), or null (anything else).
 * @param {Uint8Array} bytes
 * @returns {{ gen: string, seq: number } | 'full' | null}
 */
export function classifyPrefix(bytes) {
	const text = decoder.decode(bytes.subarray(0, PREFIX_BYTES));
	if (text.startsWith(AGE_TAG)) return 'full';
	if (bytes.length < PREFIX_BYTES || bytes[PREFIX_BYTES - 1] !== 0x0a) return null;
	const m = /^PA-SNAP\/1 ([0-9a-f]{16}) (0|[1-9][0-9]{0,9}) *$/.exec(text.slice(0, PREFIX_BYTES - 1));
	return m ? { gen: m[1], seq: Number(m[2]) } : null;
}

/** Pieces never change: what one said is kept for the session. */
const kinds = new Map();

/**
 * What a piece is, from the first provider that answers the range request;
 * null when none does (then it is listed as a full backup, as before).
 * @param {string} cid @param {string[]} bases providers' service URLs
 * @param {typeof fetch} [fetchFn]
 */
export async function pieceKind(cid, bases, fetchFn = globalThis.fetch) {
	if (kinds.has(cid)) return kinds.get(cid);
	for (const base of bases) {
		try {
			const res = await fetchFn(`${base}/piece/${cid}`, { headers: { range: `bytes=0-${PREFIX_BYTES - 1}` }, signal: AbortSignal.timeout(20_000) });
			if (!res.ok) continue;
			const kind = classifyPrefix(new Uint8Array(await res.arrayBuffer()));
			if (!kind) continue;
			kinds.set(cid, kind);
			return kind;
		} catch {
			// the next provider
		}
	}
	return null;
}

/**
 * Marks the pieces of snapshot packs (`snapshot`: gen, seq, part, parts),
 * each backup asked once by its first piece. `groups(pieces)` cuts a data
 * set's pieces into backups as for full backups (parts of PART_BYTES).
 * @param {Array<{ providerId: any, pieces: Array<{ cid: any, id: any, snapshot?: any }> }>} sets
 * @param {{ baseOf: (providerId: any) => string | undefined, groups: (pieces: any[]) => Array<{ parts: Array<{ pieceCid: string }>, pieceIds: string[] }>, cidText: (cid: any) => string, fetchFn?: typeof fetch }} o
 */
export async function markSnapshots(sets, { baseOf, groups, cidText, fetchFn }) {
	/** @type {Map<string, string[]>} */
	const holders = new Map();
	for (const ds of sets) {
		const base = baseOf(ds.providerId);
		if (!base) continue;
		for (const p of ds.pieces) holders.set(cidText(p.cid), [...(holders.get(cidText(p.cid)) ?? []), base]);
	}
	for (const ds of sets) {
		for (const g of groups(ds.pieces)) {
			const kind = await pieceKind(g.parts[0].pieceCid, holders.get(g.parts[0].pieceCid) ?? [], fetchFn);
			if (!kind || kind === 'full') continue;
			g.pieceIds.forEach((id, part) => {
				const p = ds.pieces.find((x) => String(x.id) === id);
				if (p) p.snapshot = { gen: kind.gen, seq: kind.seq, part, parts: g.parts.length };
			});
		}
	}
	return sets;
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
