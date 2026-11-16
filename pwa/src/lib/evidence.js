// The evidence of one VM, as rows: what the app pinned, computed and checked
// itself, what the VM or Aleph only reported, and what nothing confirms yet.
// The rows come from the sealed profile and from the runtime pin; the app's
// view (Evidence.svelte) and the landing page's sample render the same rows.
// Nothing here fetches anything, and nothing here knows a language: the
// texts are in evidence-i18n.js, by the ids below.

/** @typedef {{ measurement: string, policy: string | null, launchTcb: { fmc?: number | null, bootloader: number, tee: number, snp: number, microcode: number } | null, at: number, relay?: { host: string, own: boolean } | null }} Attestation */
/**
 * How the app knows a row:
 *   app       it computed, signed or verified it itself
 *   reported  the VM or Aleph says so; no hardware confirms it
 *   open      nothing confirms it yet
 * @typedef {'app' | 'reported' | 'open'} Mark
 */
/** @typedef {{ id: string, kind?: string, mark: Mark, note?: string, values: { k: string, v: string, mono?: boolean }[], links: { k: string, href: string }[] }} Row */

const REPO = 'https://github.com/Le-Space/paperless-anywhere';
const HASH = /^[0-9a-f]{64}$/;

/** The launch measurements an INSTANCE names. @param {any} tee */
export const launchesOf = (tee) => (Array.isArray(tee?.measurements) ? tee.measurements.map((m) => String(m?.registers?.launch ?? '')).filter(Boolean) : []);

/** The firmware levels of a report, in one line. @param {Attestation['launchTcb']} tcb */
export const tcbLine = (tcb) =>
	tcb ? [['fmc', tcb.fmc], ['bootloader', tcb.bootloader], ['tee', tcb.tee], ['snp', tcb.snp], ['microcode', tcb.microcode]].filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`).join(' · ') : '';

/**
 * @param {{
 *   running: Record<string, any>,
 *   rootfsItemHash?: string | null,
 *   runtime: { name: string, itemHash: string, bundleSha256: string, cmdlineTemplate: string },
 *   alephApi: string,
 *   lastGood?: { at: string, copies?: number | null, pieceCid?: string | null } | null,
 *   backupsOn?: boolean,
 *   links?: boolean
 * }} a `links: false` for made-up values: no link is built from a hash that names nothing.
 * @returns {Row[]}
 */
export function evidenceRows({ running, rootfsItemHash = null, runtime, alephApi, lastGood = null, backupsOn = false, links = true }) {
	const message = (/** @type {string | null | undefined} */ hash) => (links && hash && HASH.test(hash) ? [{ k: 'message', href: `${alephApi}/api/v0/messages/${hash}` }] : []);
	const launches = launchesOf(running.trustedExecution);
	/** @type {Attestation | null} */
	const att = running.attestation?.measurement ? running.attestation : null;
	// The library accepts a report only with one of these; said again here so
	// the view never calls a value "checked" that is not among them.
	const matches = Boolean(att && launches.includes(att.measurement));

	/** @type {Row[]} */
	const rows = [
		{
			id: 'runtime',
			mark: 'app',
			values: [
				{ k: 'name', v: runtime.name },
				{ k: 'itemHash', v: runtime.itemHash, mono: true },
				{ k: 'bundle', v: runtime.bundleSha256, mono: true },
				{ k: 'cmdline', v: runtime.cmdlineTemplate, mono: true }
			],
			// The pinned runtime is real also beside made-up values.
			links: HASH.test(runtime.itemHash) ? [{ k: 'message', href: `${alephApi}/api/v0/messages/${runtime.itemHash}` }] : []
		},
		{
			id: 'measurement',
			mark: launches.length ? 'app' : 'open',
			...(launches.length ? {} : { note: 'none' }),
			values: launches.map((v) => ({ k: 'launch', v, mono: true })),
			links: message(running.instanceHash)
		},
		{
			id: 'instance',
			mark: 'app',
			values: [
				{ k: 'instanceHash', v: String(running.instanceHash ?? ''), mono: true },
				...(running.payer ? [{ k: 'payer', v: String(running.payer), mono: true }] : [])
			],
			links: message(running.instanceHash)
		},
		{
			id: 'node',
			mark: 'reported',
			values: [{ k: 'crnHash', v: String(running.crnHash ?? ''), mono: true }, ...(running.host ? [{ k: 'host', v: String(running.host), mono: true }] : [])],
			links: []
		},
		att && matches
			? {
					id: 'attestation',
					mark: 'app',
					values: [
						{ k: 'reportMeasurement', v: att.measurement, mono: true },
						...(att.policy ? [{ k: 'policy', v: att.policy, mono: true }] : []),
						...(att.launchTcb ? [{ k: 'tcb', v: tcbLine(att.launchTcb), mono: true }] : []),
						{ k: 'at', v: new Date(att.at).toISOString() }
					],
					links: [
						{ k: 'amd', href: 'https://www.amd.com/en/developer/sev.html' },
						{ k: 'how', href: `${REPO}/blob/main/docs/workflow.md#3-attestation-and-unlock-in-detail` }
					]
				}
			: { id: 'attestation', mark: 'open', note: att ? 'mismatch' : 'notKept', values: att ? [{ k: 'reportMeasurement', v: att.measurement, mono: true }] : [], links: [] },
		// The relay that carried the attestation. It is an ordinary server, not
		// attested, so it is never more than "not confirmed"; what protects the
		// exchange is the check above, in the browser.
		{
			id: 'relay',
			mark: 'open',
			note: att?.relay?.host ? (att.relay.own ? 'relayOwn' : 'relayLeSpace') : 'relayUnknown',
			values: att?.relay?.host ? [{ k: 'relayHost', v: String(att.relay.host), mono: true }] : [],
			links: [
				{ k: 'relayWs', href: 'https://github.com/NiKrause/relay-button/tree/main/packages/attest-relay' },
				{ k: 'relayP2p', href: 'https://github.com/NiKrause/orbitdb-relay/blob/main/src/services/attest-bridge-service.ts' }
			]
		},
		{
			id: 'image',
			mark: 'open',
			note: 'notMeasured',
			values: rootfsItemHash ? [{ k: 'store', v: rootfsItemHash, mono: true }] : [],
			links: [...message(rootfsItemHash), { k: 'build', href: `${REPO}/blob/main/rootfs/build-image.sh` }]
		},
		{
			id: 'data',
			mark: running.dataDisk === 'encrypted' || running.dataDisk === 'plain' ? 'reported' : 'open',
			note: running.dataDisk === 'encrypted' ? 'sealed' : running.dataDisk === 'plain' ? 'plain' : 'unknown',
			values: [],
			links: [{ k: 'source', href: `${REPO}/blob/main/rootfs/files/paperless-data-disk` }]
		},
		{
			id: 'backups',
			mark: lastGood ? 'reported' : 'open',
			note: !backupsOn ? 'off' : lastGood ? 'encrypted' : 'noneYet',
			values: lastGood
				? [
						{ k: 'at', v: new Date(lastGood.at).toISOString() },
						...(lastGood.copies != null ? [{ k: 'copies', v: String(lastGood.copies) }] : []),
						...(lastGood.pieceCid ? [{ k: 'piece', v: lastGood.pieceCid, mono: true }] : [])
					]
				: [],
			links: [{ k: 'model', href: `${REPO}/blob/main/docs/security-model.md#backups` }]
		}
	];
	return /** @type {Row[]} */ (rows);
}

/** How many rows carry each mark. @param {Row[]} rows @returns {Record<Mark, number>} */
export const tally = (rows) => rows.reduce((n, r) => ({ ...n, [r.mark]: n[r.mark] + 1 }), { app: 0, reported: 0, open: 0 });

/**
 * The evidence of a stop or an erase, once it is over: where the backup
 * went (piece CID, each copy with its provider and data set, as the VM
 * reported them) and the FORGET that removed the VM. Only what was reported
 * or signed: the VM's status page names no transactions, so none are linked.
 * @param {{
 *   status: any,
 *   erase?: { node?: string | null, forgot?: string, revoke?: string } | null,
 *   instanceHash?: string,
 *   alephApi: string,
 *   links?: boolean
 * }} a `status`: the VM's status page at the end of the stop (null for an erase without backup)
 * @returns {Row[]}
 */
export function stopEvidenceRows({ status, erase = null, instanceHash = '', alephApi, links = true }) {
	const message = (/** @type {string | null | undefined} */ hash) => (links && hash && HASH.test(hash) ? [{ k: 'message', href: `${alephApi}/api/v0/messages/${hash}` }] : []);
	const b = status?.stop?.backup ?? status?.backup ?? null;
	const entry = b?.backup?.pieceCid ? b.backup : null;
	/** @type {Row[]} */
	const rows = [];
	if (entry) {
		const parts = Array.isArray(entry.parts) && entry.parts.length > 1 ? entry.parts : [];
		rows.push({
			id: 'stopPiece',
			mark: 'reported',
			note: 'encrypted',
			values: [
				{ k: 'piece', v: String(entry.pieceCid), mono: true },
				...(entry.date ? [{ k: 'at', v: String(entry.date) }] : []),
				...(typeof entry.size === 'number' ? [{ k: 'size', v: `${(entry.size / 1e6).toFixed(1)} MB` }] : []),
				...parts.slice(1).map((/** @type {any} */ p, /** @type {number} */ i) => ({ k: 'part', v: `${i + 2}/${parts.length} ${p.pieceCid}`, mono: true })),
				...(entry.requestedCopies ? [{ k: 'copies', v: `${entry.copies?.length ?? 0}/${entry.requestedCopies}` }] : [])
			],
			links: [{ k: 'model', href: `${REPO}/blob/main/docs/security-model.md#backups` }]
		});
		for (const c of Array.isArray(entry.copies) ? entry.copies : []) {
			rows.push({
				id: `copy-${c.providerId}-${c.dataSetId}`,
				kind: 'stopCopy',
				mark: 'reported',
				values: [
					{ k: 'provider', v: String(c.providerId ?? '') },
					...(c.location ? [{ k: 'place', v: String(c.location) }] : []),
					{ k: 'dataSet', v: String(c.dataSetId ?? ''), mono: true },
					...(c.pieceId != null ? [{ k: 'pieceId', v: String(c.pieceId), mono: true }] : [])
				],
				// The provider's own address for the piece: what it serves is ciphertext.
				links: links && /^https:\/\//.test(String(c.retrievalUrl ?? '')) ? [{ k: 'retrieval', href: String(c.retrievalUrl) }] : []
			});
		}
	}
	if (erase?.forgot !== undefined) {
		rows.push({
			id: 'stopForget',
			mark: erase.forgot ? 'app' : 'open',
			values: [
				...(instanceHash ? [{ k: 'instanceHash', v: instanceHash, mono: true }] : []),
				...(erase.forgot ? [{ k: 'forget', v: erase.forgot, mono: true }] : [])
			],
			links: [...message(instanceHash), ...message(erase.forgot).map((l) => ({ ...l, k: 'forgetMessage' }))]
		});
	}
	return rows;
}
