// Aleph aggregates for the vault, signed by keys this app derives itself. An
// address without credits may post them (measured), so no payment is involved.
import { broadcastAlephMessage, createUnsignedAggregateMessage, signAlephMessage } from '@le-space/core';
import { tr } from './i18n/index.js';

export const ALEPH_API = 'https://api2.aleph.im';
/**
 * The Aleph API hosts the app reads from, in order: when api2 does not answer
 * (2026-11-18: a start stood still on it), the same read goes to api.aleph.im.
 * Both serve the same network; what the app checks (content hashes,
 * signatures) does not depend on the host.
 */
export const ALEPH_API_HOSTS = Object.freeze([ALEPH_API, 'https://api.aleph.im']);
export const CHANNEL = 'paperless-anywhere';

async function sha256Hex(text) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The same request on each Aleph API host, in order: `url` itself when it is
 * not on one of them (a node), else one URL per host.
 * @param {string} url
 */
export function alephUrls(url) {
	const u = new URL(url);
	if (!ALEPH_API_HOSTS.includes(u.origin)) return [url];
	return [u.origin, ...ALEPH_API_HOSTS.filter((h) => h !== u.origin)].map((h) => `${h}${u.pathname}${u.search}`);
}

/**
 * A read from Aleph (or a node) that survives a short network hiccup: up to
 * `tries` attempts on a network error, a timeout or a 5xx, with a pause in
 * between. A read from Aleph asks the next host (ALEPH_API_HOSTS) at once
 * when one fails. When all fail, the error names what could not be read and
 * what each host answered, instead of the browser's bare "Failed to fetch".
 * @param {string} url @param {string} what e.g. "asking for the balance"
 * @param {RequestInit & { tries?: number, pauseMs?: number, timeoutMs?: number, fetch?: typeof fetch }} [init]
 */
export async function readFetch(url, what, { tries = 3, pauseMs = 1500, timeoutMs = 20_000, fetch: fetchImpl = fetch, ...init } = {}) {
	const urls = alephUrls(url);
	/** @type {Map<string, string>} the last answer per host */
	const last = new Map();
	for (let i = 0; i < tries; i++) {
		if (i) await sleep(pauseMs * i);
		for (const u of urls) {
			try {
				const res = await fetchImpl(u, { cache: 'no-store', ...init, signal: AbortSignal.timeout(timeoutMs) });
				if (res.status < 500) return res;
				last.set(new URL(u).host, `HTTP ${res.status}`);
			} catch (e) {
				last.set(new URL(u).host, e instanceof Error ? e.message : String(e));
			}
		}
	}
	const hosts = [...last.keys()];
	const answers = hosts.length > 1 ? hosts.map((h) => `${h}: ${last.get(h)}`).join('; ') : String(last.get(hosts[0]) ?? '');
	throw new Error(tr().net.unreachable(hosts.join(', '), what, tries, answers));
}

/**
 * Broadcast `message` and wait until Aleph has processed it. The synchronous
 * broadcast may never answer when Aleph is slow, although the message was
 * processed (live, 2026-10-23); after a minute we ask for its status instead.
 * @returns {Promise<{ httpStatus: number, response: any }>}
 */
export async function broadcast(message, { answerMs = 60_000, pollMs = 5_000, waitMs = 15 * 60_000 } = {}) {
	try {
		return await broadcastAlephMessage(message, { apiHost: ALEPH_API, sync: true, attempts: 1, fetch: (u, i) => fetch(u, { ...i, signal: AbortSignal.timeout(answerMs) }) });
	} catch (e) {
		// No answer, or a 5xx from a host that is down: whether it arrived is
		// asked below, on every host. Any other refusal stands.
		const down = ['TimeoutError', 'AbortError', 'TypeError'].includes(/** @type {any} */ (e)?.name) || /^Broadcast failed: 5\d\d\b/.test(String(/** @type {any} */ (e)?.message ?? ''));
		if (!down) throw e;
	}
	const until = Date.now() + waitMs;
	while (Date.now() < until) {
		// The status from the first host that answers. The message is signed
		// and named by its hash, so sending it again (to the host that does not
		// know it yet) can never make a second one: Aleph keeps one per hash.
		for (const host of ALEPH_API_HOSTS) {
			const res = await fetch(`${host}/api/v0/messages/${message.item_hash}`, { cache: 'no-store', signal: AbortSignal.timeout(answerMs) }).catch(() => null);
			if (!res || res.status >= 500) continue;
			const status = res.ok ? (await res.json().catch(() => null))?.status : null;
			if (status === 'processed') return { httpStatus: 200, response: { message_status: status } };
			if (status === 'rejected' || status === 'forgotten') return { httpStatus: 422, response: { message_status: status } };
			// Not known yet (404): the broadcast may not have arrived; send it again, unsynchronised.
			if (res.status === 404) await broadcastAlephMessage(message, { apiHost: host, sync: false, fetch: (u, i) => fetch(u, { ...i, signal: AbortSignal.timeout(answerMs) }) }).catch(() => null);
			break;
		}
		await sleep(pollMs);
	}
	throw new Error(`Aleph did not process the ${message.type} within ${Math.round(waitMs / 60_000)} minutes`);
}

/**
 * Write `content` under `key` in the aggregate of `account` (a viem local account).
 * @param {import('viem').LocalAccount} account
 */
export async function writeAggregate(account, key, content) {
	const unsigned = await createUnsignedAggregateMessage({
		sender: account.address,
		content: /** @type {any} */ ({ address: account.address, key, content, time: Date.now() / 1000 }),
		hasher: sha256Hex,
		channel: CHANNEL
	});
	const message = await signAlephMessage(unsigned, (_sender, payload) => account.signMessage({ message: payload }));
	const { httpStatus, response } = await broadcast(message);
	if (httpStatus >= 300) throw new Error(`Aleph refused the vault (${httpStatus}): ${JSON.stringify(response).slice(0, 160)}`);
	return message.item_hash;
}

/** The content under `key` in the aggregate of `address`, or null. */
export async function readAggregate(address, key) {
	const res = await readFetch(`${ALEPH_API}/api/v0/aggregates/${address}.json?keys=${encodeURIComponent(key)}`, tr().net.readSettings);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Aleph answered ${res.status}`);
	return (await res.json())?.data?.[key] ?? null;
}
