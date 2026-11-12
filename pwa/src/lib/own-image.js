// "Mein Image bauen" (docs/own-image.md): this vault's own copy of the public
// Paperless image, sealed with a passphrase derived from the master secret.
// The image builder runs measured and closed: the plain image is part of
// what the app attests, and nothing leaves the builder but through the
// attested channel. So the app attests it, sends the passphrase, fetches the
// sealed image back in pieces, stores it on Aleph itself under its own
// address, and notes the new image in the profile.
import { ALEPH_API, CHANNEL, readFetch } from './aleph.js';
import { imagePassphrase } from './keys/derive.js';
import { sha256Hex } from './vm.js';

/**
 * The builder this app trusts, and the plain image it asks for. `null` until
 * a builder runs: the setup then shows no such step.
 *
 * `measurements` and `policy` are what the attestation must show (computed
 * from the V-PROGRAM runtime and the builder's root hashes); `route` is how
 * an attest relay reaches the builder; `plain` names the public image the
 * builder holds by its SHA-256 (the builder refuses to seal any other), where
 * it lies on Aleph for anyone to compare, and the commit it was built from;
 * `vprogram` is the builder's V-PROGRAM message on Aleph. All of it is
 * public, and the setup shows it (`sources`).
 * @type {null | { route: string, measurements: string[], policy: number | string, vprogram?: string, plain: { sha256: string, store?: string, commit?: string } }}
 */
export const BUILDER = null;

const HEX64 = /^[0-9a-f]{64}$/;
const CID = /^[A-Za-z0-9]{40,64}$/;
const decoder = new TextDecoder();

export class BuilderError extends Error {
	/** @param {string} message */
	constructor(message) {
		super(message);
		this.name = 'BuilderError';
	}
}

export const REPOSITORY = 'https://github.com/Le-Space/paperless-anywhere';
export const ALEPH_MESSAGE = 'https://api2.aleph.im/api/v0/messages';

/**
 * What a person's image is made from and by, as rows to show: every value
 * that is fixed in the app, with a link where there is something to open.
 * @param {NonNullable<typeof BUILDER>} builder
 * @returns {{ label: string, value: string, href?: string }[]}
 */
export function sources(builder) {
	const { plain } = checkBuilder(builder);
	const rows = [{ label: 'Öffentliches Image, SHA-256', value: plain.sha256 }];
	if (HEX64.test(plain.store ?? '')) rows.push({ label: 'Öffentliches Image bei Aleph', value: /** @type {string} */ (plain.store), href: `${ALEPH_MESSAGE}/${plain.store}` });
	if (/^[0-9a-f]{40}$/.test(plain.commit ?? '')) rows.push({ label: 'Gebaut aus dem Quelltext-Stand', value: /** @type {string} */ (plain.commit), href: `${REPOSITORY}/tree/${plain.commit}` });
	if (/^[0-9a-f]{64}$/.test(builder.vprogram ?? '')) rows.push({ label: 'Build-Dienst bei Aleph', value: /** @type {string} */ (builder.vprogram), href: `${ALEPH_MESSAGE}/${builder.vprogram}` });
	for (const m of builder.measurements) rows.push({ label: 'Messwert des Build-Dienstes', value: m });
	return rows;
}

/** A builder entry that is complete, or an error that says what is missing. */
export function checkBuilder(builder) {
	if (!builder?.route || !builder.measurements?.length || builder.policy == null) throw new BuilderError('Der Build-Dienst ist in dieser App nicht festgelegt.');
	if (!HEX64.test(builder.plain?.sha256 ?? '')) throw new BuilderError('Das öffentliche Image ist in dieser App nicht festgelegt.');
	return builder;
}

/**
 * The STORE message for the encrypted image `cid`, owned and paid by the
 * app's own address, signed by its key.
 * @param {{ address: string, signMessage: (a: { message: string }) => Promise<string> }} app
 * @param {string} cid @param {number} [time] seconds
 */
export async function storeMessage(app, cid, time = Date.now() / 1000) {
	if (!CID.test(cid)) throw new BuilderError('Der Build-Dienst hat keine gültige Adresse für das Image genannt.');
	const item_content = JSON.stringify({ address: app.address, time, item_type: 'ipfs', item_hash: cid, payment: { type: 'credit' } });
	const item_hash = await sha256Hex(item_content);
	const message = { sender: app.address, chain: 'ETH', type: 'STORE', item_hash, item_type: 'inline', item_content, time, channel: CHANNEL };
	const signature = await app.signMessage({ message: [message.chain, message.sender, message.type, message.item_hash].join('\n') });
	return { ...message, signature };
}

/** One JSON call over the attested channel. */
async function call(channel, method, path, body) {
	const response = await channel.request(method, path, body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
	let answer = null;
	try {
		answer = JSON.parse(decoder.decode(response.body));
	} catch {
		/* no JSON: the status says enough */
	}
	return { status: response.status, answer };
}

const refused = (what, { status, answer }) => new BuilderError(`${what} (${status}${answer?.error ? `: ${String(answer.error).slice(0, 200)}` : ''}).`);

/** Aleph's word on the STORE: processed, or an error. */
async function awaitStore(itemHash, { read, sleep, tries, delayMs }) {
	for (let i = 0; i < tries; i++) {
		const status = await read(itemHash);
		if (status === 'processed') return;
		if (status === 'rejected' || status === 'forgotten') throw new BuilderError('Aleph hat das Image nicht angenommen. Reicht das Guthaben der App-Adresse für den Speicher?');
		await sleep(delayMs);
	}
	throw new BuilderError('Aleph hat das Image noch nicht bestätigt. Es ist hochgeladen; bitte später erneut bauen oder den Hash prüfen.');
}

const storeStatus = async (itemHash) => {
	const res = await readFetch(`${ALEPH_API}/api/v0/messages/${itemHash}`, 'Image bei Aleph prüfen', { cache: 'no-store' }).catch(() => null);
	return res?.ok ? ((await res.json().catch(() => null))?.status ?? null) : null;
};

/** The sealed image comes back in pieces of this size, each one request over the attested channel. */
export const PIECE_BYTES = 1024 * 1024;

/**
 * Stores `image` on Aleph beside its signed STORE `message`, as the app's
 * own address, and says which content address the node made.
 * @param {Blob} image @param {object} message
 */
async function storeOnAleph(image, message) {
	const form = new FormData();
	form.append('file', image, 'rootfs');
	form.append('metadata', JSON.stringify({ message, sync: true }));
	const response = await fetch(`${ALEPH_API}/api/v0/ipfs/add_file`, { method: 'POST', body: form });
	const answer = await response.json().catch(() => null);
	return { status: response.status, cid: answer?.hash ?? null };
}

/**
 * Builds this vault's own image and returns what the profile keeps:
 * `{ rootfsItemHash, luksPassphrase, luksFor, ownImage }`.
 *
 * `open` resolves to an attested channel to the builder (and must reject
 * unless the attestation shows the builder's measurement); the passphrase
 * goes through it, and the sealed image comes back through it.
 * @param {{
 *   master: Uint8Array,
 *   app: { address: string, signMessage: (a: { message: string }) => Promise<string> },
 *   builder: NonNullable<typeof BUILDER>,
 *   open: () => Promise<{ request: (method: string, path: string, init?: any) => Promise<{ status: number, body: Uint8Array }>, close: () => void }>,
 *   onProgress?: (p: { step: 'attest' | 'build' | 'fetch' | 'sign' | 'upload' | 'confirm', detail?: string }) => void,
 *   store?: typeof storeOnAleph,
 *   read?: (itemHash: string) => Promise<string | null>,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   pollMs?: number, buildTries?: number, confirmTries?: number, pieceBytes?: number
 * }} a
 */
export async function buildOwnImage({ master, app, builder, open, onProgress = () => {}, store = storeOnAleph, read = storeStatus, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now, pollMs = 5000, buildTries = 240, confirmTries = 180, pieceBytes = PIECE_BYTES }) {
	const { plain } = checkBuilder(builder);
	const passphrase = imagePassphrase(master, plain.sha256);

	onProgress({ step: 'attest', detail: 'Build-Dienst prüfen (AMD)' });
	const channel = await open();
	let job = '';
	try {
		onProgress({ step: 'build', detail: 'Image wird versiegelt' });
		const started = await call(channel, 'POST', '/build', { sha256: plain.sha256, passphrase });
		if (started.status === 503) throw new BuilderError('Der Build-Dienst baut gerade ein anderes Image. Bitte in ein paar Minuten noch einmal versuchen.');
		job = started.answer?.job ?? '';
		if (started.status !== 202 || !/^[0-9a-f]{48}$/.test(job)) throw refused('Der Build-Dienst hat den Auftrag nicht angenommen', started);

		let built = null;
		for (let i = 0; i < buildTries && !built; i++) {
			await sleep(pollMs);
			const state = await call(channel, 'GET', `/job/${job}`);
			if (state.status !== 200) throw refused('Der Build-Dienst kennt den Auftrag nicht mehr', state);
			if (state.answer?.state === 'failed') throw new BuilderError(`Der Bau ist fehlgeschlagen${state.answer.error ? `: ${String(state.answer.error).slice(0, 200)}` : ''}.`);
			if (state.answer?.state === 'built') built = state.answer;
		}
		if (!built) throw new BuilderError('Der Bau hat zu lange gedauert.');
		const size = Number(built.size);
		if (!Number.isSafeInteger(size) || size <= 0 || size > 1024 ** 3) throw new BuilderError('Der Build-Dienst nennt keine gültige Größe für das Image.');

		// The sealed image, piece by piece. It holds nothing readable without the
		// passphrase, and each piece arrives over the attested channel.
		const pieces = [];
		for (let start = 0; start < size; start += pieceBytes) {
			const end = Math.min(start + pieceBytes, size) - 1;
			onProgress({ step: 'fetch', detail: `Versiegeltes Image holen (${Math.round((start / size) * 100)} %)` });
			const piece = await channel.request('GET', `/job/${job}/image`, { headers: { range: `bytes=${start}-${end}` } });
			if (piece.status !== 206 || piece.body.length !== end - start + 1) throw new BuilderError(`Der Build-Dienst hat ein Stück des Images nicht geliefert (${piece.status}).`);
			pieces.push(piece.body);
		}
		const image = new Blob(pieces, { type: 'application/octet-stream' });

		onProgress({ step: 'sign', detail: 'Speicher-Nachricht signieren' });
		const message = await storeMessage(app, built.cid, now() / 1000);

		onProgress({ step: 'upload', detail: `Image zu Aleph hochladen (${Math.round(size / 1048576)} MiB)` });
		const stored = await store(image, message);
		if (stored.status >= 300) throw new BuilderError(`Aleph hat das Image nicht angenommen (${stored.status}). Reicht das Guthaben der App-Adresse für den Speicher?`);
		// The node names the content address it made from what it received.
		if (stored.cid && stored.cid !== built.cid) throw new BuilderError('Aleph hat ein anderes Image gespeichert als das versiegelte.');

		onProgress({ step: 'confirm', detail: 'Auf Aleph warten' });
		await awaitStore(message.item_hash, { read, sleep, tries: confirmTries, delayMs: pollMs });
		return {
			rootfsItemHash: message.item_hash,
			luksPassphrase: passphrase,
			luksFor: message.item_hash,
			ownImage: { plainSha256: plain.sha256, cid: built.cid, builtAt: new Date(now()).toISOString() }
		};
	} finally {
		// Whatever happened: the builder need not keep this vault's image.
		if (job) await call(channel, 'DELETE', `/job/${job}`).catch(() => null);
		channel.close();
	}
}

/**
 * An attested channel to `builder`, over the profile's attest relays: the
 * handshake completes only for the builder's measurement and policy.
 * @param {NonNullable<typeof BUILDER>} builder @param {Record<string, any>} profile
 */
export async function openBuilder(builder, profile) {
	const [{ attestGuest }, { relayTransports }, { attestRelaysFor }, wasm] = await Promise.all([
		import('@le-space/attest-wasm/ratls'),
		import('./attest-p2p.js'),
		import('./relays.js'),
		import('@le-space/attest-wasm/pkg/relay_button_attest.js')
	]);
	await wasm.default();
	const relays = await attestRelaysFor(profile);
	const transports = relayTransports(relays);
	for (let i = 0; ; i++) {
		try {
			return (await attestGuest({ wasm, transport: transports(builder.route), expectedMeasurements: builder.measurements, expectedPolicy: builder.policy })).channel;
		} catch (error) {
			if (i + 1 >= relays.length || /rejected|measurement|policy|signature/i.test(String(error))) throw error;
		}
	}
}

/** True when the profile's image is one this vault had built from `plainSha256`. */
export const hasOwnImage = (profile, plainSha256) => Boolean(profile?.ownImage) && profile.ownImage.plainSha256 === plainSha256 && profile.luksFor === profile.rootfsItemHash;
