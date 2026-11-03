// Aleph aggregates for the vault, signed by keys this app derives itself. An
// address without credits may post them (measured), so no payment is involved.
import { broadcastAlephMessage, createUnsignedAggregateMessage, signAlephMessage } from '@le-space/core';

export const ALEPH_API = 'https://api2.aleph.im';
export const CHANNEL = 'paperless-anywhere';

async function sha256Hex(text) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A read from Aleph (or a node) that survives a short network hiccup: up to
 * `tries` attempts on a network error, a timeout or a 5xx, with a pause in
 * between. When all fail, the error names what could not be read, instead of
 * the browser's bare "Failed to fetch".
 * @param {string} url @param {string} what e.g. "Guthaben abfragen"
 * @param {RequestInit & { tries?: number, pauseMs?: number, timeoutMs?: number, fetch?: typeof fetch }} [init]
 */
export async function readFetch(url, what, { tries = 3, pauseMs = 1500, timeoutMs = 20_000, fetch: fetchImpl = fetch, ...init } = {}) {
	let last = '';
	for (let i = 0; i < tries; i++) {
		if (i) await sleep(pauseMs * i);
		try {
			const res = await fetchImpl(url, { cache: 'no-store', ...init, signal: AbortSignal.timeout(timeoutMs) });
			if (res.status < 500) return res;
			last = `HTTP ${res.status}`;
		} catch (e) {
			last = e instanceof Error ? e.message : String(e);
		}
	}
	throw new Error(`${new URL(url).host} nicht erreichbar (${what}, ${tries} Versuche: ${last}). Verbindung prüfen und erneut versuchen.`);
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
		if (!['TimeoutError', 'AbortError', 'TypeError'].includes(/** @type {any} */ (e)?.name)) throw e;
	}
	const until = Date.now() + waitMs;
	while (Date.now() < until) {
		const res = await fetch(`${ALEPH_API}/api/v0/messages/${message.item_hash}`, { cache: 'no-store' }).catch(() => null);
		const status = res?.ok ? (await res.json().catch(() => null))?.status : null;
		if (status === 'processed') return { httpStatus: 200, response: { message_status: status } };
		if (status === 'rejected' || status === 'forgotten') return { httpStatus: 422, response: { message_status: status } };
		// Not known yet (404): the broadcast may not have arrived; send it again, unsynchronised.
		if (res?.status === 404) await broadcastAlephMessage(message, { apiHost: ALEPH_API, sync: false, fetch: (u, i) => fetch(u, { ...i, signal: AbortSignal.timeout(answerMs) }) }).catch(() => null);
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
	const res = await readFetch(`${ALEPH_API}/api/v0/aggregates/${address}.json?keys=${encodeURIComponent(key)}`, 'Einstellungen lesen');
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Aleph answered ${res.status}`);
	return (await res.json())?.data?.[key] ?? null;
}
