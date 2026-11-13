// "Mein Image bauen" (docs/own-image.md): this vault's own copy of the public
// Paperless image, sealed with a passphrase derived from the master secret.
// The image builder runs measured and closed: the plain image is part of
// what the app attests, and nothing leaves the builder but through the
// attested channel. So the app attests it, sends the passphrase, fetches the
// sealed image back in runs (each over a connection attested anew, because a
// relay carries only a few MiB per connection), stores it on Aleph itself
// under its own address, and notes the new image in the profile.
import { ALEPH_API, CHANNEL, readFetch } from './aleph.js';
import { tr } from './i18n/index.js';
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
	/** @param {string} message @param {string} [code] what failed, for code that must tell errors apart whatever the language */
	constructor(message, code) {
		super(message);
		this.name = 'BuilderError';
		this.code = code;
	}
}

export const REPOSITORY = 'https://github.com/Le-Space/paperless-anywhere';
export const ALEPH_MESSAGE = 'https://api2.aleph.im/api/v0/messages';

/**
 * What a person's image is made from and by, as rows to show: every value
 * that is fixed in the app, with a link where there is something to open.
 * @param {NonNullable<typeof BUILDER>} builder
 * @param {Record<'plainSha256' | 'plainStore' | 'commit' | 'vprogram' | 'measurement', string>} [labels] a component passes `$t.ownImage.sources` to follow the language
 * @returns {{ label: string, value: string, href?: string }[]}
 */
export function sources(builder, labels = tr().ownImage.sources) {
	const { plain } = checkBuilder(builder);
	const rows = [{ label: labels.plainSha256, value: plain.sha256 }];
	if (HEX64.test(plain.store ?? '')) rows.push({ label: labels.plainStore, value: /** @type {string} */ (plain.store), href: `${ALEPH_MESSAGE}/${plain.store}` });
	if (/^[0-9a-f]{40}$/.test(plain.commit ?? '')) rows.push({ label: labels.commit, value: /** @type {string} */ (plain.commit), href: `${REPOSITORY}/tree/${plain.commit}` });
	if (/^[0-9a-f]{64}$/.test(builder.vprogram ?? '')) rows.push({ label: labels.vprogram, value: /** @type {string} */ (builder.vprogram), href: `${ALEPH_MESSAGE}/${builder.vprogram}` });
	for (const m of builder.measurements) rows.push({ label: labels.measurement, value: m });
	return rows;
}

/** A builder entry that is complete, or an error that says what is missing. */
export function checkBuilder(builder) {
	if (!builder?.route || !builder.measurements?.length || builder.policy == null) throw new BuilderError(tr().ownImage.error.noBuilder);
	if (!HEX64.test(builder.plain?.sha256 ?? '')) throw new BuilderError(tr().ownImage.error.noPlain);
	return builder;
}

/**
 * The STORE message for the encrypted image `cid`, owned and paid by the
 * app's own address, signed by its key.
 * @param {{ address: string, signMessage: (a: { message: string }) => Promise<string> }} app
 * @param {string} cid @param {number} [time] seconds
 */
export async function storeMessage(app, cid, time = Date.now() / 1000) {
	if (!CID.test(cid)) throw new BuilderError(tr().ownImage.error.badCid);
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

/** @param {'notAccepted' | 'jobUnknown'} what */
const refused = (what, { status, answer }) => new BuilderError(tr().ownImage.error[what](status, answer?.error ? String(answer.error).slice(0, 200) : ''));

/** Aleph's word on the STORE: processed, or an error. */
async function awaitStore(itemHash, { read, sleep, tries, delayMs }) {
	for (let i = 0; i < tries; i++) {
		const status = await read(itemHash);
		if (status === 'processed') return;
		if (status === 'rejected' || status === 'forgotten') throw new BuilderError(tr().ownImage.error.storeRejected, 'store-rejected');
		await sleep(delayMs);
	}
	throw new BuilderError(tr().ownImage.error.storePending);
}

const storeStatus = async (itemHash) => {
	const res = await readFetch(`${ALEPH_API}/api/v0/messages/${itemHash}`, tr().ownImage.checkStore, { cache: 'no-store' }).catch(() => null);
	return res?.ok ? ((await res.json().catch(() => null))?.status ?? null) : null;
};

/** The sealed image comes back in pieces of this size, each one request over an attested channel. */
export const PIECE_BYTES = 1024 * 1024;
/**
 * What one connection carries. An attest relay closes a connection after
 * 4 MiB in one direction or 120 seconds, so the image comes in runs of this
 * size, each over a connection of its own, attested like the first.
 */
export const RUN_BYTES = 3 * 1024 * 1024;
/** Connections side by side; a relay allows one client four. */
export const LANES = 4;
/** How often one run is tried before the fetch gives up. */
export const RUN_TRIES = 4;

/** An attestation that was refused: nothing is retried after that. */
const refusedAttestation = (error) => /rejected|measurement|policy|signature/i.test(String(error));

/**
 * The sealed image of `job`, `size` bytes, as a Blob: in runs of `runBytes`,
 * each over a fresh channel from `open` and in pieces of `pieceBytes`, up to
 * `lanes` runs at a time. A run that breaks off is fetched again; a job the
 * builder no longer has, or a builder that fails its attestation, ends it.
 */
async function fetchImage({ open, job, size, pieceBytes, runBytes, lanes, runTries, sleep, retryMs, onBytes }) {
	const runs = [];
	for (let start = 0; start < size; start += runBytes) runs.push({ start, end: Math.min(start + runBytes, size) });
	const parts = new Array(runs.length);
	let next = 0;
	let failed = null;

	const fetchRun = async (run) => {
		let last = '';
		for (let attempt = 0; attempt < runTries && !failed; attempt++) {
			if (attempt) await sleep(retryMs * attempt);
			let channel = null;
			try {
				channel = await open();
				const pieces = [];
				for (let start = run.start; start < run.end; start += pieceBytes) {
					const end = Math.min(start + pieceBytes, run.end) - 1;
					const piece = await channel.request('GET', `/job/${job}/image`, { headers: { range: `bytes=${start}-${end}` } });
					if ([404, 409, 410, 416].includes(piece.status)) throw new BuilderError(tr().ownImage.error.imageGone(piece.status));
					if (piece.status !== 206 || piece.body.length !== end - start + 1) throw new Error(String(piece.status));
					pieces.push(piece.body);
					onBytes(piece.body.length);
				}
				return pieces;
			} catch (error) {
				if (error instanceof BuilderError || refusedAttestation(error)) throw error;
				last = error instanceof Error ? error.message : String(error);
			} finally {
				channel?.close();
			}
		}
		throw new BuilderError(tr().ownImage.error.pieceMissing(last.slice(0, 120)));
	};
	const lane = async () => {
		while (!failed && next < runs.length) {
			const index = next++;
			try {
				parts[index] = await fetchRun(runs[index]);
			} catch (error) {
				failed ??= error;
			}
		}
	};
	await Promise.all(Array.from({ length: Math.max(1, Math.min(lanes, runs.length)) }, lane));
	if (failed) throw failed;
	return new Blob(parts.flat(), { type: 'application/octet-stream' });
}

/**
 * An image that was fetched but is not confirmed on Aleph yet, kept while the
 * page is open: a second try uploads it again instead of building and
 * fetching it again. It holds nothing readable without the passphrase.
 * @type {{ current: null | { key: string, cid: string, size: number, image: Blob, attested: null | { measurement: string, at: string }, message?: any } }}
 */
const fetched = { current: null };

/**
 * Stores `image` on Aleph beside its signed STORE `message`, as the app's
 * own address, and says which content address the node made.
 * @param {Blob} image @param {object} message
 */
export async function storeOnAleph(image, message) {
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
 * unless the attestation shows the builder's measurement). It is called for
 * the build, where the passphrase goes through it, and again for every run of
 * the sealed image that comes back; a channel may say which measurement the
 * hardware reported (`measurement`), which is kept as `ownImage.builder`.
 * @param {{
 *   master: Uint8Array,
 *   app: { address: string, signMessage: (a: { message: string }) => Promise<string> },
 *   builder: NonNullable<typeof BUILDER>,
 *   open: () => Promise<{ request: (method: string, path: string, init?: any) => Promise<{ status: number, body: Uint8Array }>, close: () => void, measurement?: string }>,
 *   onProgress?: (p: { step: 'attest' | 'build' | 'fetch' | 'sign' | 'upload' | 'confirm', detail?: string }) => void,
 *   store?: typeof storeOnAleph,
 *   read?: (itemHash: string) => Promise<string | null>,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   kept?: typeof fetched,
 *   pollMs?: number, buildTries?: number, confirmTries?: number, pieceBytes?: number, runBytes?: number, lanes?: number, runTries?: number, retryMs?: number
 * }} a
 */
export async function buildOwnImage({ master, app, builder, open, onProgress = () => {}, store = storeOnAleph, read = storeStatus, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now, kept = fetched, pollMs = 5000, buildTries = 240, confirmTries = 180, pieceBytes = PIECE_BYTES, runBytes = RUN_BYTES, lanes = LANES, runTries = RUN_TRIES, retryMs = 2000 }) {
	const { plain } = checkBuilder(builder);
	const passphrase = imagePassphrase(master, plain.sha256);
	const key = `${app.address.toLowerCase()}/${plain.sha256}`;
	if (kept.current?.key !== key) kept.current = null;

	if (!kept.current) kept.current = await sealAndFetch();
	const { cid, size, image, attested } = kept.current;

	// A STORE that was signed and uploaded before is only waited for again.
	let message = kept.current.message;
	if (!message) {
		onProgress({ step: 'sign', detail: tr().ownImage.step.sign });
		message = await storeMessage(app, cid, now() / 1000);
		onProgress({ step: 'upload', detail: tr().ownImage.step.upload(size) });
		const stored = await store(image, message);
		if (stored.status >= 300) throw new BuilderError(tr().ownImage.error.uploadRefused(stored.status));
		// The node names the content address it made from what it received.
		if (stored.cid && stored.cid !== cid) {
			kept.current = null;
			throw new BuilderError(tr().ownImage.error.otherImage);
		}
		kept.current.message = message;
	}

	onProgress({ step: 'confirm', detail: tr().ownImage.step.confirm });
	try {
		await awaitStore(message.item_hash, { read, sleep, tries: confirmTries, delayMs: pollMs });
	} catch (error) {
		// Refused: the next try signs and uploads anew. Not confirmed yet: it waits again.
		if (error instanceof BuilderError && error.code === 'store-rejected') delete kept.current.message;
		throw error;
	}
	kept.current = null;
	return {
		rootfsItemHash: message.item_hash,
		luksPassphrase: passphrase,
		luksFor: message.item_hash,
		ownImage: {
			plainSha256: plain.sha256,
			cid,
			builtAt: new Date(now()).toISOString(),
			...(attested ? { builder: { vprogram: builder.vprogram ?? null, measurement: attested.measurement, attestedAt: attested.at } } : {})
		}
	};

	/** Has the builder seal the image and fetches it; the builder drops it afterwards, whatever happened. */
	async function sealAndFetch() {
		onProgress({ step: 'attest', detail: tr().ownImage.step.attest });
		let channel = await open();
		const attested = typeof channel.measurement === 'string' && channel.measurement ? { measurement: channel.measurement, at: new Date(now()).toISOString() } : null;
		let job = '';
		try {
			onProgress({ step: 'build', detail: tr().ownImage.step.build });
			// Sent once, over the channel that was just attested, and never again.
			const started = await call(channel, 'POST', '/build', { sha256: plain.sha256, passphrase });
			if (started.status === 503) throw new BuilderError(tr().ownImage.error.busy);
			job = started.answer?.job ?? '';
			if (started.status !== 202 || !/^[0-9a-f]{48}$/.test(job)) throw refused('notAccepted', started);

			// A relay ends a connection after two minutes: asking goes on over a new one.
			let built = null;
			let drops = 0;
			for (let i = 0; i < buildTries && !built; i++) {
				await sleep(pollMs);
				let state;
				try {
					channel ??= await open();
					state = await call(channel, 'GET', `/job/${job}`);
				} catch (error) {
					channel?.close();
					channel = null;
					if (refusedAttestation(error)) throw error;
					if (++drops > 5) throw new BuilderError(tr().ownImage.error.dropped);
					continue;
				}
				drops = 0;
				if (state.status !== 200) throw refused('jobUnknown', state);
				if (state.answer?.state === 'failed') throw new BuilderError(tr().ownImage.error.buildFailed(state.answer.error ? String(state.answer.error).slice(0, 200) : ''));
				if (state.answer?.state === 'built') built = state.answer;
			}
			if (!built) throw new BuilderError(tr().ownImage.error.buildSlow);
			const size = Number(built.size);
			if (!Number.isSafeInteger(size) || size <= 0 || size > 1024 ** 3) throw new BuilderError(tr().ownImage.error.badSize);
			if (!CID.test(built.cid ?? '')) throw new BuilderError(tr().ownImage.error.badCid);
			channel?.close();
			channel = null;

			// The sealed image holds nothing readable without the passphrase, and
			// every run of it arrives over a channel attested like the first.
			let got = 0;
			const shown = () => onProgress({ step: 'fetch', detail: tr().ownImage.step.fetch(Math.floor((got / size) * 100)) });
			shown();
			const image = await fetchImage({ open, job, size, pieceBytes, runBytes, lanes, runTries, sleep, retryMs, onBytes: (n) => { got += n; shown(); } });
			return { key, cid: built.cid, size, image, attested };
		} finally {
			channel?.close();
			// Whatever happened: the builder need not keep this vault's image.
			if (job) {
				let last = null;
				try {
					last = await open();
					await call(last, 'DELETE', `/job/${job}`);
				} catch {
					/* it removes an image nobody touched by itself */
				} finally {
					last?.close();
				}
			}
		}
	}
}

/**
 * How `buildOwnImage` reaches `builder`: a function that opens an attested
 * channel over one of the profile's attest relays. The handshake completes
 * only for the builder's measurement and policy. It is called many times
 * during one build, so it begins with the relay that carried the last one.
 * @param {NonNullable<typeof BUILDER>} builder @param {Record<string, any>} profile
 * @param {{ load?: () => Promise<{ attestGuest: any, relayTransports: (relays: string[]) => (url: string) => any, relays: string[], wasm: any }> }} [deps]
 */
export function builderOpener(builder, profile, { load = loadAttest } = {}) {
	let loaded = null;
	let good = 0;
	return async () => {
		loaded ??= load(profile);
		const { attestGuest, relayTransports, relays, wasm } = await loaded;
		if (!relays.length) throw new BuilderError(tr().ownImage.error.noRelay);
		let last = null;
		for (let i = 0; i < relays.length; i++) {
			const index = (good + i) % relays.length;
			try {
				const attested = await attestGuest({ wasm, transport: relayTransports([relays[index]])(builder.route), expectedMeasurements: builder.measurements, expectedPolicy: builder.policy });
				good = index;
				const measurement = attested.freshVerified?.measurement;
				return Object.assign(attested.channel, measurement ? { measurement: String(measurement) } : {});
			} catch (error) {
				if (refusedAttestation(error)) throw error;
				last = error;
			}
		}
		throw new BuilderError(tr().ownImage.error.unreachable(String(last instanceof Error ? last.message : last).slice(0, 120)));
	};
}

async function loadAttest(profile) {
	const [{ attestGuest }, { relayTransports }, { attestRelaysFor }, wasm] = await Promise.all([
		import('@le-space/attest-wasm/ratls'),
		import('./attest-p2p.js'),
		import('./relays.js'),
		import('@le-space/attest-wasm/pkg/relay_button_attest.js')
	]);
	await wasm.default();
	return { attestGuest, relayTransports, relays: await attestRelaysFor(profile), wasm };
}

/** True when the profile's image is one this vault had built from `plainSha256`. */
export const hasOwnImage = (profile, plainSha256) => Boolean(profile?.ownImage) && profile.ownImage.plainSha256 === plainSha256 && profile.luksFor === profile.rootfsItemHash;
