// The attest relays Le Space runs, found on Aleph as Belege finds its UCEP
// relays (Le-Space/belege#565): an orbitdb-relay deployed with relay-button
// registers its addresses in the channel `simple-todo` and names the account
// that runs it (`ownerAddress`) and its instance (the end of the registration
// id). Anybody can post such an entry, so it counts only when Aleph holds the
// instance as a running VM of one of Le Space's accounts, and only the
// instance's own 2n6.me name is used. Every orbitdb-relay since
// NiKrause/relay-button#178 serves the attest relay at /attest there.
//
// A relay carries the RA-TLS records the WASM checks and cannot read them, so
// trusting it is about availability, not secrets.
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { ALEPH_API } from './aleph.js';
import { relayList } from './attest-p2p.js';

export const RELAY_REGISTRATION = Object.freeze({ channel: 'simple-todo', ref: 'simple-todo-bootstrap', type: 'relay-bootstrap-v2' });

/** The Aleph accounts Le Space pays its relays from. */
export const TRUSTED_RELAY_OWNERS = Object.freeze([
	// relay-button
	'0x28129bdDa64310221480d4eF903446b0cdFD4BEb',
	// orbitdb-relay
	'0x2bd014B41FEa490320187b5FAdf413dab88f7628'
]);

/** The 2n6.me name Aleph's gateway gives an instance: the hash's first 44 bits as four BIP39 words. @param {string} instanceHash */
export function twoN6Host(instanceHash) {
	const bits = parseInt(String(instanceHash).slice(0, 11), 16);
	return `${[33, 22, 11, 0].map((shift) => wordlist[Math.floor(bits / 2 ** shift) % 2048]).join('-')}.2n6.me`;
}

/**
 * The registrations that name a trusted account and their instance, newest
 * first and one per instance, with the instance's 2n6.me name. Still to be
 * checked against the instance itself (`ownedInstance`).
 * @param {any} payload the answer of `/api/v0/posts.json`
 * @param {readonly string[]} [owners]
 * @returns {{ instance: string, owner: string, host: string }[]}
 */
export function ownerRegistrations(payload, owners = TRUSTED_RELAY_OWNERS) {
	const trusted = new Set(owners.map((o) => o.toLowerCase()));
	/** @type {Map<string, { time: number, instance: string, owner: string, host: string }>} */
	const newest = new Map();
	for (const post of Array.isArray(payload?.posts) ? payload.posts : []) {
		let content = post?.content;
		if (!content && typeof post?.item_content === 'string') {
			try {
				content = JSON.parse(post.item_content)?.content;
			} catch {
				continue;
			}
		}
		const owner = String(content?.ownerAddress ?? '').toLowerCase();
		const instance = /^relay:orbitdb-relay:.*:([0-9a-f]{64})$/.exec(String(content?.registrationId ?? ''))?.[1];
		if (!instance || !trusted.has(owner)) continue;
		const host = twoN6Host(instance);
		// The relay must announce itself on that name, not just name the instance.
		const multiaddrs = Array.isArray(content?.multiaddrs) ? content.multiaddrs.map(String) : [];
		if (!multiaddrs.some((addr) => addr.split('/')[2] === host)) continue;
		const time = Number(post?.time ?? 0);
		if ((newest.get(instance)?.time ?? -1) < time) newest.set(instance, { time, instance, owner, host });
	}
	return [...newest.values()].sort((a, b) => b.time - a.time).map(({ instance, owner, host }) => ({ instance, owner, host }));
}

/**
 * Whether Aleph holds `instance` as a processed INSTANCE of `owner`.
 * @param {string} instance @param {string} owner @param {typeof fetch} fetchImpl
 */
export async function ownedInstance(instance, owner, fetchImpl = fetch) {
	try {
		const res = await fetchImpl(`${ALEPH_API}/api/v0/messages/${instance}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
		if (!res.ok) return false;
		const body = await res.json();
		return body?.status === 'processed' && body?.message?.type === 'INSTANCE' && body?.message?.item_hash === instance && String(body?.message?.content?.address ?? '').toLowerCase() === owner.toLowerCase();
	} catch {
		return false;
	}
}

/**
 * Le Space's attest relays as Aleph knows them now, `wss://<name>/attest`,
 * newest first; empty when Aleph cannot be asked.
 * @param {{ fetch?: typeof fetch }} [options]
 * @returns {Promise<string[]>}
 */
export async function findAttestRelays({ fetch: fetchImpl = fetch } = {}) {
	try {
		const params = new URLSearchParams({ channels: RELAY_REGISTRATION.channel, refs: RELAY_REGISTRATION.ref, types: RELAY_REGISTRATION.type, pagination: '200' });
		const res = await fetchImpl(`${ALEPH_API}/api/v0/posts.json?${params}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
		if (!res.ok) return [];
		const candidates = ownerRegistrations(await res.json());
		const owned = await Promise.all(candidates.map((c) => ownedInstance(c.instance, c.owner, fetchImpl)));
		return candidates.filter((_, i) => owned[i]).map((c) => `wss://${c.host}/attest`);
	} catch {
		return [];
	}
}

/**
 * The relays to try for a start or a stop: those set in the profile first (a
 * test's own, or a relay of one's own), then Le Space's as Aleph knows them.
 * @param {{ attestRelay?: string | null }} profile
 * @param {() => Promise<string[]>} [find]
 */
export async function attestRelaysFor(profile, find = findAttestRelays) {
	const configured = profile.attestRelay ? relayList(profile.attestRelay) : [];
	const relays = [...new Set([...configured, ...(await find())])];
	if (!relays.length) throw new Error('Kein Attest-Relay: keins eingetragen, und Aleph kennt gerade keins von Le Space.');
	return relays;
}
