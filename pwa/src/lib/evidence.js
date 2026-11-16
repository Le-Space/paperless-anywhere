// The evidence of one VM, as rows: what the app pinned, computed and checked
// itself, what the VM or Aleph only reported, what lies outside the hardware's
// check by design, and what nothing confirms yet.
// The rows come from the sealed profile and from the runtime pin; the app's
// view (Evidence.svelte) and the landing page's sample render the same rows.
// Nothing here fetches anything, and nothing here knows a language: the
// texts are in evidence-i18n.js, by the ids below.

/** @typedef {{ measurement: string, policy: string | null, launchTcb: { fmc?: number | null, bootloader: number, tee: number, snp: number, microcode: number } | null, at: number, relay?: { host: string, own: boolean } | null }} Attestation */
/**
 * How the app knows a row:
 *   app       it computed, signed or verified it itself
 *   reported  the VM or Aleph says so; no hardware confirms it
 *   outside   the hardware's check does not cover it, by design (the image's
 *             content, the relay); something else protects it, the row says what
 *   open      nothing confirms it yet
 * @typedef {'app' | 'reported' | 'outside' | 'open'} Mark
 */
/** @typedef {{ id: string, kind?: string, mark: Mark, note?: string, values: { k: string, v: string, mono?: boolean, copy?: boolean, say?: boolean }[], links: { k: string, href: string }[] }} Row */

/**
 * A link reported by the VM or a provider, only if it is an https URL;
 * anything else (another scheme, garbage) gives ''.
 * @param {unknown} url
 */
export const httpsUrl = (url) => (/^https:\/\//.test(String(url ?? '')) ? String(url) : '');

const REPO = 'https://github.com/Le-Space/paperless-anywhere';
/** The backups' encryption, as the backup tool does it (age-encryption, one X25519 recipient). */
export const AGE_METHOD = 'age v1 · X25519 · HKDF-SHA-256 · ChaCha20-Poly1305 (64 KiB)';
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
 *   ownImage?: boolean,
 *   links?: boolean
 * }} a `links: false` for made-up values: no link is built from a hash that names nothing.
 * `ownImage`: the image is this vault's own, encrypted by builder/encrypt-image.sh.
 * @returns {Row[]}
 */
export function evidenceRows({ running, rootfsItemHash = null, runtime, alephApi, lastGood = null, backupsOn = false, ownImage = false, links = true }) {
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
		// attested, so it lies outside the hardware's check; what protects the
		// exchange is the check above, in the browser.
		{
			id: 'relay',
			mark: 'outside',
			note: att?.relay?.host ? (att.relay.own ? 'relayOwn' : 'relayLeSpace') : 'relayUnknown',
			values: att?.relay?.host ? [{ k: 'relayHost', v: String(att.relay.host), mono: true }] : [],
			links: [
				{ k: 'relayWs', href: 'https://github.com/NiKrause/relay-button/tree/main/packages/attest-relay' },
				{ k: 'relayP2p', href: 'https://github.com/NiKrause/orbitdb-relay/blob/main/src/services/attest-bridge-service.ts' }
			]
		},
		// An own image's disk: LUKS2, aes-xts-plain64, a 512-bit key, as
		// builder/encrypt-image.sh sets it. Its key derivation is cryptsetup's
		// default (not set there), so it is not named. Never the passphrase.
		{
			id: 'image',
			mark: 'outside',
			note: 'notMeasured',
			values: [...(rootfsItemHash ? [{ k: 'store', v: rootfsItemHash, mono: true }] : []), ...(ownImage ? [{ k: 'luks', v: 'luks', say: true }] : [])],
			links: [...message(rootfsItemHash), { k: 'build', href: `${REPO}/blob/main/rootfs/build-image.sh` }, ...(ownImage ? [{ k: 'encryptImage', href: `${REPO}/blob/main/builder/encrypt-image.sh` }] : [])]
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
export const tally = (rows) => rows.reduce((n, r) => ({ ...n, [r.mark]: n[r.mark] + 1 }), { app: 0, reported: 0, outside: 0, open: 0 });

/**
 * The evidence of a stop or an erase, once it is over: where the backup
 * went (piece CID, each copy with its provider and data set, as the VM
 * reported them) and the FORGET that removed the VM. Only what was reported
 * or signed: the VM's status page names no transactions, so none are linked.
 * @param {{
 *   status: any,
 *   erase?: { node?: string | null, forgot?: string, revoke?: string } | null,
 *   instanceHash?: string,
 *   recipient?: string | null,
 *   fromVault?: boolean,
 *   header?: string | null,
 *   alephApi: string,
 *   links?: boolean,
 *   docsLang?: 'de' | 'en'
 * }} a `status`: the VM's status page at the end of the stop (null for an erase without backup);
 * `recipient`: the public age key the app gave the VM (backupConfig.ageRecipient);
 * `fromVault`: its identity is the one derived from the vault; `header`: the
 * app's check of the backup's age header (backup-header.js); `docsLang`: which
 * language the linked guide is in
 * @returns {Row[]}
 */
export function stopEvidenceRows({ status, erase = null, instanceHash = '', recipient = null, fromVault = false, header = null, alephApi, links = true, docsLang = 'en' }) {
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
		// How it was encrypted: what paperless-backup-filecoin does (age-encryption's
		// Encrypter with one X25519 recipient, config.ageRecipient). Green only
		// when the app opened the header with this vault's key itself.
		rows.push({
			id: 'stopSealed',
			mark: header === 'opens' ? 'app' : 'reported',
			note: header === 'opens' ? 'headerOpens' : header === 'refused' ? 'headerRefused' : 'headerUnchecked',
			values: [
				{ k: 'method', v: AGE_METHOD },
				...(recipient ? [{ k: 'recipient', v: recipient, mono: true, copy: true }] : []),
				...(recipient ? [{ k: 'keyFrom', v: fromVault ? 'vault' : 'profile', say: true }] : [])
			],
			links: [
				{ k: 'ageSpec', href: 'https://age-encryption.org/v1' },
				// The guide in the app's language (docs/restore-yourself.md, .de.md).
				{ k: 'selfCheck', href: `${REPO}/blob/main/docs/restore-yourself${docsLang === 'de' ? '.de' : ''}.md` }
			]
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
				links: links && httpsUrl(c.retrievalUrl) ? [{ k: 'retrieval', href: httpsUrl(c.retrievalUrl) }] : []
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
