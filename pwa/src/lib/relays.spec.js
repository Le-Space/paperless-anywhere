import { describe, expect, it } from 'vitest';
import { attestRelaysFor, findAttestRelays, ownedInstance, ownerRegistrations, twoN6Host } from './relays.js';

// Made-up accounts, instances and peers; the names follow from the hashes.
const OWNER = '0x00000000000000000000000000000000000000c1';
const STRANGER = '0x00000000000000000000000000000000000000ff';
const INSTANCE = '0'.repeat(64);
const HOST = 'abandon-abandon-abandon-abandon.2n6.me';
const OTHER = 'f'.repeat(64);
const PEER = '12D3KooWAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const post = (owner, instance, time, multiaddrs) => ({
	sender: '0x00000000000000000000000000000000000000d1',
	time,
	item_content: JSON.stringify({ content: { registrationId: `relay:orbitdb-relay:main:${instance}`, ownerAddress: owner, multiaddrs } })
});
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

describe('twoN6Host', () => {
	it('names an instance by its first 44 bits as four BIP39 words', () => {
		expect(twoN6Host(INSTANCE)).toBe(HOST);
		expect(twoN6Host(OTHER)).toBe('zoo-zoo-zoo-zoo.2n6.me');
		expect(twoN6Host('00200400801' + '0'.repeat(53))).toBe('ability-ability-ability-ability.2n6.me');
	});
});

describe('ownerRegistrations', () => {
	it('keeps a trusted account’s relays that announce their own name, newest first, one per instance', () => {
		const payload = {
			posts: [
				post(OWNER, INSTANCE, 100, [`/dns4/${HOST}/tcp/443/tls/ws/p2p/${PEER}`]),
				post(OWNER.toUpperCase().replace('0X', '0x'), INSTANCE, 200, [`/dns4/${HOST}/tcp/443/tls/ws/p2p/${PEER}`]),
				post(OWNER, OTHER, 300, [`/dns4/evil.example.com/tcp/443/tls/ws/p2p/${PEER}`]),
				post(STRANGER, OTHER, 400, [`/dns4/zoo-zoo-zoo-zoo.2n6.me/tcp/443/tls/ws/p2p/${PEER}`]),
				{ sender: OWNER, item_content: '{' }
			]
		};
		expect(ownerRegistrations(payload, [OWNER])).toEqual([{ instance: INSTANCE, owner: OWNER, host: HOST }]);
	});
});

describe('ownedInstance', () => {
	const message = (over = {}) => ({ status: 'processed', message: { type: 'INSTANCE', item_hash: INSTANCE, content: { address: OWNER } }, ...over });
	it('holds only for a processed INSTANCE of that account', async () => {
		expect(await ownedInstance(INSTANCE, OWNER, async () => json(message()))).toBe(true);
		expect(await ownedInstance(INSTANCE, STRANGER, async () => json(message()))).toBe(false);
		expect(await ownedInstance(INSTANCE, OWNER, async () => json(message({ status: 'forgotten' })))).toBe(false);
		expect(await ownedInstance(INSTANCE, OWNER, async () => json({}, 404))).toBe(false);
		expect(await ownedInstance(INSTANCE, OWNER, () => Promise.reject(new Error('down')))).toBe(false);
	});
});

describe('findAttestRelays', () => {
	const fetchWith = (instanceOwner) => async (url) =>
		String(url).includes('/api/v0/messages/')
			? json({ status: 'processed', message: { type: 'INSTANCE', item_hash: INSTANCE, content: { address: instanceOwner } } })
			: json({ posts: [post('0x28129bdDa64310221480d4eF903446b0cdFD4BEb', INSTANCE, 1, [`/dns4/${HOST}/tcp/443/tls/ws/p2p/${PEER}`])] });
	it('gives the confirmed relays’ attest URL, and none for an instance someone else owns', async () => {
		expect(await findAttestRelays({ fetch: fetchWith('0x28129bdDa64310221480d4eF903446b0cdFD4BEb') })).toEqual([`wss://${HOST}/attest`]);
		expect(await findAttestRelays({ fetch: fetchWith(STRANGER) })).toEqual([]);
		expect(await findAttestRelays({ fetch: () => Promise.reject(new Error('down')) })).toEqual([]);
	});
});

describe('attestRelaysFor', () => {
	it('tries the profile’s own relays first, then those found, each once', async () => {
		const found = async () => [`wss://${HOST}/attest`, 'wss://own.example.com/attest'];
		expect(await attestRelaysFor({ attestRelay: 'wss://own.example.com/attest' }, found)).toEqual(['wss://own.example.com/attest', `wss://${HOST}/attest`]);
		expect(await attestRelaysFor({ attestRelay: null }, found)).toEqual(await found());
	});
	it('fails when there is none at all', async () => {
		await expect(attestRelaysFor({}, async () => [])).rejects.toThrow(/Kein Attest-Relay/);
	});
});
