// Aleph aggregates for the vault, signed by keys this app derives itself. An
// address without credits may post them (measured), so no payment is involved.
import { broadcastAlephMessage, createUnsignedAggregateMessage, signAlephMessage } from '@le-space/core';

export const ALEPH_API = 'https://api2.aleph.im';
export const CHANNEL = 'paperless-anywhere';

async function sha256Hex(text) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
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
	const { httpStatus, response } = await broadcastAlephMessage(message, { apiHost: ALEPH_API, sync: true, fetch: (u, i) => fetch(u, i) });
	if (httpStatus >= 300) throw new Error(`Aleph refused the vault (${httpStatus}): ${JSON.stringify(response).slice(0, 160)}`);
	return message.item_hash;
}

/** The content under `key` in the aggregate of `address`, or null. */
export async function readAggregate(address, key) {
	const res = await fetch(`${ALEPH_API}/api/v0/aggregates/${address}.json?keys=${encodeURIComponent(key)}`, { cache: 'no-store' });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Aleph answered ${res.status}`);
	return (await res.json())?.data?.[key] ?? null;
}
