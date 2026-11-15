// "Mein Image bauen" (docs/own-image.md): this vault's own copy of the public
// Paperless image, sealed with a passphrase derived from the master secret.
// The image builder runs measured and closed: the plain image is part of
// what the app attests, and nothing leaves the builder but through the
// attested channel. So the app attests it, sends the passphrase, fetches the
// sealed image back in runs (each over a connection attested anew, because a
// relay carries only a few MiB per connection), stores it on Aleph itself
// under its own address, and notes the new image in the profile.
import { createUnsignedForgetMessage, signAlephMessage } from '@le-space/core';
import { ALEPH_API, CHANNEL, broadcast, readFetch } from './aleph.js';
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
 *
 * Or, with `program` (the V-PROGRAM content of a published builder) and
 * `crn` (the node that runs V-PROGRAMs), no builder runs between builds:
 * each build starts one from that content, on the same volumes and so with
 * the same measurement, and forgets it afterwards (`buildOnOwnBuilder`).
 * @type {null | { route?: string, program?: Record<string, any>, crn?: string, measurements: string[], policy: number | string, vprogram?: string, plain: { sha256: string, store?: string, commit?: string } }}
 */
export const BUILDER = {
	// Published 2026-11-14 (workflow "Image builder on Aleph", run 43623983622)
	// for the plain image of release image e85b9c9a…, then deleted again: its
	// volumes stay on Aleph, and each build starts a V-PROGRAM from this content.
	program: {
		allow_amend: false,
		environment: {
			internet: true
		},
		metadata: {
			name: 'paperless-image-builder'
		},
		payment: {
			type: 'credit'
		},
		requirements: {
			node: {
				node_hash: '01a3143b384ca43a3af338031b03ae86c0a4e139a24b848475d3ddb9bfbce8fa'
			}
		},
		resources: {
			memory: 6144,
			seconds: 30,
			vcpus: 2
		},
		runtime: {
			comment: '',
			ref: 'b8e43148123e34f5f02ffd65bab62b716b74706ba77cf10cbe329af32f01f10a'
		},
		verification: {
			backend: 'sev_snp',
			measurements: [
				{
					platform: 'sev_snp',
					registers: {
						launch: '0ae0dd5305913c6e8cdec0a6bf9f2a6dd5582705ce7e9edc86341b37cd7b62e46d7b668cd1fb391c78638db86a5ef0d6'
					},
					vcpu_type: 'EPYC-Genoa'
				},
				{
					platform: 'sev_snp',
					registers: {
						launch: '289ea5fe8713448d331c49d1846cbaac0ad505f8ad060eebc227528093eef01edd9f422e686d56aa446caa3bc4066201'
					},
					vcpu_type: 'EPYC-v4'
				}
			],
			policy: 196608
		},
		volumes: [
			{
				comment: '',
				hash_tree: '2c5221ed8fd5994cf4b7bc4b4f13a7fcaa8582b0c3ca91073282401bfba8c808',
				ref: 'a451e9e7d1402c1a009a713c9436ebb81a747105955a04c58791a18653375ef7',
				roothash: '45b6e9f5d5c9f60b3c854deb75b9c8c3e364934964493e3039259bef58ec1200'
			}
		],
		workload: {
			hash_tree: '20e2c950550924aa885c36442a6a3c2cf0dd34e343d2655a7a644b6ca82680e4',
			ref: '271bfe3ff9f2af3479c2d756e4b8e701c3fb1bd78c9babd406c2209d526d7700',
			roothash: 'ac72e745bca84a1644dc0379d43e282e3b36ed07281807a87b04c0c15ca815b6'
		}
	},
	crn: '01a3143b384ca43a3af338031b03ae86c0a4e139a24b848475d3ddb9bfbce8fa',
	measurements: [
		'0ae0dd5305913c6e8cdec0a6bf9f2a6dd5582705ce7e9edc86341b37cd7b62e46d7b668cd1fb391c78638db86a5ef0d6',
		'289ea5fe8713448d331c49d1846cbaac0ad505f8ad060eebc227528093eef01edd9f422e686d56aa446caa3bc4066201'
	],
	policy: 196608,
	plain: {
		sha256: 'ea56e682870cbb1f0972c60c13b13a6d80ec941f09d39332130fef165f6e8518',
		store: '9c32bd396008a2c166e49a271934e934194e41fac5985ff4fc9fc6ab0a9a288b',
		commit: 'b11b8a51229af5db0b7271634f5857fbbcd4b847'
	}
};

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
	// A running builder has a route; one started for each build has its
	// V-PROGRAM content and the node, and gets its route when it starts.
	const reachable = Boolean(builder?.route) || (Boolean(builder?.program?.verification) && HEX64.test(builder?.crn ?? ''));
	if (!reachable || !builder.measurements?.length || builder.policy == null) throw new BuilderError(tr().ownImage.error.noBuilder);
	if (!HEX64.test(builder.plain?.sha256 ?? '')) throw new BuilderError(tr().ownImage.error.noPlain);
	return builder;
}

/**
 * The STORE message for the encrypted image `cid`, owned and paid by the
 * app's own address, signed by its key.
 * @param {{ address: string, signMessage: (a: { message: string }) => Promise<string> }} app
 * @param {string} cid @param {number} [time] seconds
 */
export async function storeMessage(app, cid, time = Date.now() / 1000, payer = app.address) {
	if (!CID.test(cid)) throw new BuilderError(tr().ownImage.error.badCid);
	// `payer`: the address that owns and pays it; the app's own, or the Le
	// Space sub-account a package pays from, which lets the app's key send it.
	const item_content = JSON.stringify({ address: payer, time, item_type: 'ipfs', item_hash: cid, payment: { type: 'credit' } });
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

/**
 * The sealed image comes back in pieces of this size, each one request over
 * an attested channel. The channel collects an answer by joining what
 * arrives, so its cost grows with the square of the piece: a quarter MiB
 * keeps that small and still needs few round trips.
 */
export const PIECE_BYTES = 256 * 1024;
/**
 * What one run asks for. A relay that lets an image builder carry more per
 * connection (relay-button#230: 256 MiB, 10 minutes) brings a run over one
 * connection, attested once. A relay with the default limits (4 MiB, 120 s)
 * closes it earlier; the run then goes on from its last piece over a new
 * connection at once. So a large run costs nothing where the relay is
 * strict and saves some 280 attestations where it is not. Three lanes keep
 * the download going while one connection is attested.
 */
export const RUN_BYTES = 32 * 1024 * 1024;
/**
 * Connections side by side. A relay allows one client four at a time, and a
 * closed one counts until the relay has seen it close: three leave room for
 * that, and for the next run's connection while the last one closes.
 */
export const LANES = 3;
/**
 * How often a run may fail in a row, without a single piece coming back,
 * before the fetch gives up. A try that brings pieces starts the count
 * anew, and the next try goes on where the last one broke off: an unsteady
 * connection (a VPN across continents, 2026-11-15) only slows it down.
 */
export const RUN_TRIES = 10;
/** The longest wait between two tries of a run. */
export const RETRY_MAX_MS = 30_000;

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
		const pieces = [];
		let at = run.start;
		for (let failures = 0; failures < runTries && !failed; ) {
			if (failures) await sleep(Math.min(retryMs * failures, RETRY_MAX_MS));
			let channel = null;
			const before = at;
			try {
				channel = await open();
				for (; at < run.end; ) {
					const end = Math.min(at + pieceBytes, run.end) - 1;
					const piece = await channel.request('GET', `/job/${job}/image`, { headers: { range: `bytes=${at}-${end}` } });
					if ([404, 409, 410, 416].includes(piece.status)) throw new BuilderError(tr().ownImage.error.imageGone(piece.status));
					if (piece.status !== 206 || piece.body.length !== end - at + 1) throw new Error(String(piece.status));
					pieces.push(piece.body);
					at = end + 1;
					onBytes(piece.body.length);
				}
				return pieces;
			} catch (error) {
				// The image gone, or an attestation refused: trying again cannot help.
				// A builder or relay not answering for a moment can (2026-11-13: a
				// relay closed two connections during their attestation).
				if (refusedAttestation(error) || (error instanceof BuilderError && error.code !== 'unreachable')) throw error;
				last = error instanceof Error ? error.message : String(error);
				// Pieces came back: the connection is slow, not gone. Count anew.
				// Pieces came back: a relay's limit or a short break, not a dead
				// line. Go on at once; only tries without any piece wait and count.
				failures = at > before ? 0 : failures + 1;
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
export async function storeOnAleph(image, message, api = ALEPH_API) {
	const form = new FormData();
	form.append('file', image, 'rootfs');
	form.append('metadata', JSON.stringify({ message, sync: true }));
	const response = await fetch(`${api}/api/v0/ipfs/add_file`, { method: 'POST', body: form });
	const text = await response.text().catch(() => '');
	let answer = null;
	try {
		answer = JSON.parse(text);
	} catch {
		/* not JSON: kept as the reason below */
	}
	// What Aleph said when it refused, for the message and for a measurement.
	const reason = response.ok ? '' : String(answer?.error ?? answer?.message ?? text).replace(/\s+/g, ' ').slice(0, 300);
	return { status: response.status, cid: answer?.hash ?? null, reason };
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
 *   onProgress?: (p: { step: 'start' | 'attest' | 'build' | 'fetch' | 'sign' | 'upload' | 'confirm', detail?: string }) => void,
 *   store?: typeof storeOnAleph,
 *   read?: (itemHash: string) => Promise<string | null>,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   kept?: typeof fetched,
 *   pollMs?: number, buildTries?: number, confirmTries?: number, pieceBytes?: number, runBytes?: number, lanes?: number, runTries?: number, retryMs?: number
 * }} a
 */
export async function buildOwnImage({ master, app, payer = app.address, builder, open, onProgress = () => {}, store = storeOnAleph, read = storeStatus, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now, kept = fetched, pollMs = 5000, buildTries = 240, confirmTries = 180, pieceBytes = PIECE_BYTES, runBytes = RUN_BYTES, lanes = LANES, runTries = RUN_TRIES, retryMs = 2000 }) {
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
		message = await storeMessage(app, cid, now() / 1000, payer);
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
			if (started.status === 503 && /busy/i.test(String(started.answer?.error ?? ''))) throw new BuilderError(tr().ownImage.error.busy);
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
			// Tried a few times: an image left behind keeps the builder busy for
			// everyone until it expires (30 minutes; seen 2026-11-13).
			for (let attempt = 0; job && attempt < 4; attempt++) {
				if (attempt) await sleep(retryMs * attempt);
				let last = null;
				try {
					last = await open();
					const dropped = await call(last, 'DELETE', `/job/${job}`);
					if (dropped.status === 200 || dropped.status === 404) job = '';
				} catch {
					/* tried again; at worst the builder removes it after 30 minutes */
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
		throw new BuilderError(tr().ownImage.error.unreachable(String(last instanceof Error ? last.message : last).slice(0, 120)), 'unreachable');
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

/**
 * Which image the setup shows as chosen: the vault's own once one is built
 * for `builder`'s plain image, else the public one. Without a builder there
 * is no choice. @param {Record<string, any>} profile @param {typeof BUILDER} builder
 * @returns {'public' | 'own'}
 */
export const imageKindOf = (profile, builder) => (builder && hasOwnImage(profile, builder.plain.sha256) ? 'own' : 'public');

/**
 * What saving the image step stores. With the own image, only the node: the
 * image and its passphrase come from the build. With the public one, the
 * image's hash, and its passphrase whenever the image is another than the
 * profile's (every image has a passphrase of its own). Throws what the
 * setup shows.
 * @param {{ kind: 'public' | 'own', image: string, crn: string, pass: string, profile: Record<string, any> }} a
 */
export function imageFields({ kind, image, crn, pass, profile }) {
	const node = crn.trim().toLowerCase();
	if (!HEX64.test(node)) throw new Error(tr().ownImage.fields.node);
	if (kind === 'own') return { crnHash: node };
	const hash = image.trim().toLowerCase();
	if (!HEX64.test(hash)) throw new Error(tr().ownImage.fields.image);
	// A pasted passphrase may carry a stray space or line break; the guest only
	// finds out when it opens the disk, and then waits without a word.
	const passphrase = pass.trim();
	const other = Boolean(profile.rootfsItemHash) && hash !== profile.rootfsItemHash;
	if (other && !passphrase) throw new Error(tr().ownImage.fields.otherPassphrase);
	const bound = passphrase ? { luksPassphrase: passphrase, luksFor: hash } : profile.luksPassphrase && !profile.luksFor ? { luksFor: hash } : {};
	return { rootfsItemHash: hash, crnHash: node, ...bound };
}

/**
 * A builder started for one build. The app fixes the builder's V-PROGRAM
 * content (`program`: runtime, workload and volumes with their root hashes,
 * resources, the node), not a running builder: the measured boot line holds
 * the runtime, the root hashes and the resources, not the message's own
 * hash, so every V-PROGRAM with that content shows the same measurement
 * (tried on Aleph, 2026-11-14, #202). The volumes stay published; what a
 * build starts, the V-PROGRAM, it forgets again, also when the build fails.
 * @typedef {NonNullable<typeof BUILDER> & { program: Record<string, any>, crn: string }} BuilderTemplate
 */

/**
 * The V-PROGRAM message for one build: the fixed content with the app's
 * address and the time, signed by the app's key, which pays like the STORE.
 * @param {{ address: string, signMessage: (a: { message: string }) => Promise<string> }} app
 * @param {BuilderTemplate} builder @param {number} [time] seconds
 */
export async function builderMessage(app, builder, time = Date.now() / 1000, payer = app.address) {
	if (!builder?.program?.verification || !HEX64.test(builder.crn ?? '')) throw new BuilderError(tr().ownImage.error.noBuilder);
	const item_content = JSON.stringify({ ...builder.program, address: payer, time });
	const unsigned = { sender: app.address, chain: 'ETH', type: 'V-PROGRAM', item_hash: await sha256Hex(item_content), item_type: 'inline', item_content, time, channel: CHANNEL };
	return signAlephMessage(unsigned, (_sender, payload) => app.signMessage({ message: payload }));
}

/** The FORGET of the build's V-PROGRAM, signed by the app's key. */
export async function builderForget(app, vprogram, time = Date.now() / 1000, payer = app.address) {
	const unsigned = await createUnsignedForgetMessage({ sender: payer, hashes: [vprogram], reason: 'paperless-anywhere image built', hasher: sha256Hex, channel: CHANNEL, now: time });
	// The FORGET is in the payer's name, sent by the app's key.
	return signAlephMessage({ ...unsigned, sender: app.address }, (_sender, payload) => app.signMessage({ message: payload }));
}

/** @param {any} message */
const send = async (message) => {
	const { httpStatus } = await broadcast(message);
	if (httpStatus >= 300) throw new BuilderError(tr().ownImage.error.builderRefused(httpStatus));
};

/**
 * Forget a build's V-PROGRAM, a few times. True when Aleph took the FORGET.
 * @param {{ address: string, signMessage: (a: { message: string }) => Promise<string> }} app
 * @param {string} vprogram @param {{ post?: (message: any) => Promise<void>, sleep?: (ms: number) => Promise<void>, tries?: number, retryMs?: number }} [deps]
 */
export async function forgetBuilder(app, vprogram, { post = send, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), tries = 4, retryMs = 5000, payer = app.address } = {}) {
	for (let attempt = 0; attempt < tries; attempt++) {
		if (attempt) await sleep(retryMs * attempt);
		try {
			await post(await builderForget(app, vprogram, undefined, payer));
			return true;
		} catch {
			/* tried again; the profile keeps it for the next opening otherwise */
		}
	}
	return false;
}

/**
 * Build the vault's own image on a builder started for this build, and
 * forget that builder afterwards, whatever happened. The profile notes the
 * builder between start and forget (`onStarted`, `onForgotten`), so a
 * closed window leaves nothing running for longer than the next opening
 * (`forgetLeftBuilder`). An image already fetched in this window (an upload
 * that failed) needs no builder: it is only uploaded again.
 * @param {Omit<Parameters<typeof buildOwnImage>[0], 'builder' | 'open'> & {
 *   builder: BuilderTemplate,
 *   opener: (running: NonNullable<typeof BUILDER>) => () => Promise<any>,
 *   onStarted?: (vprogram: string) => Promise<void> | void,
 *   onForgotten?: (vprogram: string) => Promise<void> | void,
 *   post?: (message: any) => Promise<void>,
 *   upTries?: number, upMs?: number
 * }} a
 */
export async function buildOnOwnBuilder({ builder, opener, onStarted = () => {}, onForgotten = () => {}, post = send, upTries = 40, upMs = 15_000, ...rest }) {
	const { master, app, payer = app.address, onProgress = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), kept = fetched } = rest;
	checkBuilder(builder);
	const key = `${app.address.toLowerCase()}/${builder.plain.sha256}`;
	if (kept.current?.key === key) return buildOwnImage({ ...rest, builder, open: () => Promise.reject(new BuilderError(tr().ownImage.error.noBuilder)) });

	onProgress({ step: 'start', detail: tr().ownImage.step.start });
	const message = await builderMessage(app, builder, undefined, payer);
	const vprogram = message.item_hash;
	// Noted once Aleph took it: a V-PROGRAM Aleph refused (no credits) is
	// nothing to forget, and a note of it would be tried again at every opening.
	let accepted = false;
	try {
		await post(message);
		accepted = true;
		await onStarted(vprogram);
		const running = { ...builder, route: `?crn=${builder.crn}&vm=${vprogram}`, vprogram };
		const open = opener(running);
		// The node starts the builder within minutes (about four, 2026-11-14):
		// until then a connection does not reach it. A refused attestation is final.
		// The guest attests before its workload is up: the proxy in front of
		// it answers 503 "upstream not ready" until then (2026-11-14, 21 s
		// after the start). So it is up once the builder itself answers.
		let first = null;
		for (let i = 0; !first; i++) {
			try {
				const channel = await open();
				const hello = await call(channel, 'GET', '/');
				if (hello.status === 200 && hello.answer?.service) first = channel;
				else channel.close?.();
			} catch (error) {
				if (refusedAttestation(error) || !(error instanceof BuilderError && error.code === 'unreachable')) throw error;
			}
			if (first) break;
			if (i + 1 >= upTries) throw new BuilderError(tr().ownImage.error.unreachable('not up'), 'unreachable');
			await sleep(upMs);
		}
		let handed = false;
		const openFirst = () => (handed ? open() : ((handed = true), Promise.resolve(first)));
		return await buildOwnImage({ ...rest, master, builder: running, open: openFirst });
	} finally {
		if (accepted && (await forgetBuilder(app, vprogram, { post, sleep, payer }))) await onForgotten(vprogram);
	}
}

// Aleph starts a V-PROGRAM only when its payer holds a day of everything it
// then pays for: the builder and what already runs (min_runtime_days: 1).
// Measured 2026-11-14: the builder 23.75 credits a second (2,052,000 a day),
// the STORE of a sealed image (868 MiB) 0.045 a second; used when Aleph's
// price estimate cannot be asked.
export const BUILDER_CREDITS_PER_HOUR = 85_500;
export const IMAGE_STORE_CREDITS_PER_HOUR = 170;

/**
 * Whether `address` can pay a build now: its credits against a day of the
 * builder, the image's storage and what the account already spends. Read
 * only; null fields when Aleph could not be asked (the setup then offers the
 * build, and Aleph's own answer decides).
 * @param {{ address: string, signMessage: (a: { message: string }) => Promise<string> }} app
 * @param {BuilderTemplate} builder
 * @param {{ balance?: (address: string) => Promise<{ credits: number }>, running?: (address: string) => Promise<number>, estimate?: (message: any) => Promise<number | null> }} [deps]
 * @returns {Promise<{ ok: boolean | null, need: number | null, have: number | null }>}
 */
export async function buildAffordable(app, builder, deps = {}) {
	const balances = deps.balance && deps.running ? null : await import('./balances.js');
	const balance = deps.balance ?? /** @type {any} */ (balances).alephBalance;
	const running = deps.running ?? /** @type {any} */ (balances).runningCreditsPerHour;
	const estimate = deps.estimate ?? (async (message) => (await import('./vm.js')).estimateCreditsPerHour(message));
	try {
		const [{ credits }, spending, perHour] = await Promise.all([balance(app.address), running(app.address), builderMessage(app, builder).then(estimate).catch(() => null)]);
		const need = Math.ceil(((perHour ?? BUILDER_CREDITS_PER_HOUR) + IMAGE_STORE_CREDITS_PER_HOUR + spending) * 24);
		return { ok: credits >= need, need, have: credits };
	} catch {
		return { ok: null, need: null, have: null };
	}
}

/**
 * A builder a closed window left behind (`profile.ownBuilder`): forget it.
 * @param {{ address: string, signMessage: (a: { message: string }) => Promise<string> }} app
 * @param {Record<string, any>} profile @param {Parameters<typeof forgetBuilder>[2]} [deps]
 * @returns {Promise<boolean>} true when there was one and it is forgotten
 */
export async function forgetLeftBuilder(app, profile, deps) {
	const vprogram = profile?.ownBuilder?.vprogram;
	if (!HEX64.test(vprogram ?? '')) return false;
	const payer = /^0x[0-9a-fA-F]{40}$/.test(profile.ownBuilder.payer ?? '') ? profile.ownBuilder.payer : app.address;
	return forgetBuilder(app, vprogram, { ...deps, payer });
}

/**
 * A build paid by the Le Space package (Le Space Credits, model A): the
 * service charges the balance and grants the sub-account (`owner`) what
 * Aleph's one-day check needs; the app's key sends the builder, the STORE
 * and the FORGETs for that sub-account, and tells the service when it is
 * over, so the rest of the grant goes back. `charge` and `done` are
 * imageBuild and imageBuildDone (credits.js) bound to the vault.
 * @param {Parameters<typeof buildOnOwnBuilder>[0] & {
 *   charge: () => Promise<{ buildId: string | null, owner: string }>,
 *   done: (d: { buildId: string, failed?: boolean, program?: string | null }) => Promise<any>
 * }} a
 */
export async function buildPaidByPackage({ charge, done, onStarted = () => {}, ...rest }) {
	const { buildId, owner } = await charge();
	if (!buildId) throw new BuilderError(tr().ownImage.error.noBuilder);
	/** @type {string | null} */
	let program = null;
	let ok = false;
	try {
		const built = await buildOnOwnBuilder({ ...rest, payer: owner, onStarted: (v) => ((program = v), onStarted(v, { buildId, payer: owner })) });
		ok = true;
		return built;
	} finally {
		// Without an accepted V-PROGRAM no builder ran: the service undoes the charge.
		await done({ buildId, failed: !ok, program }).catch(() => {});
	}
}

/**
 * What the overview says about the image, in one place:
 * - `own`: this vault's own image is in the profile;
 * - `builtAt`: when it was built;
 * - `buildsAtStart`: the first start will build one (Le Space pays, nothing
 *   yet; see buildsImageFirst in lifecycle.js, passed in to keep this module
 *   free of it);
 * - `newer`: an own image was built from another plain image than the one
 *   the fixed builder holds now, so a new build gives the newer version.
 * @param {Record<string, any>} profile @param {typeof BUILDER} builder
 * @param {{ buildsAtStart?: boolean }} [o]
 * @returns {{ own: boolean, builtAt: string | null, buildsAtStart: boolean, newer: boolean }}
 */
export function imageStatus(profile, builder, { buildsAtStart = false } = {}) {
	const own = Boolean(profile?.ownImage) && profile.luksFor === profile.rootfsItemHash && Boolean(profile.rootfsItemHash);
	const newer = own && Boolean(builder?.plain?.sha256) && profile.ownImage.plainSha256 !== builder?.plain?.sha256;
	return { own, builtAt: own ? (profile.ownImage.builtAt ?? null) : null, buildsAtStart: !own && buildsAtStart, newer };
}
