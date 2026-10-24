import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { ATTEST_PROTOCOL, libp2pTransport, relayList, relayTransports } from './attest-p2p.js';

const PEER = '12D3KooWQt2YjDezcdMk7PpCT71xqrQhnFU7vLwWv5kAk6oFtuyP';
const CRN = 'a'.repeat(64);
const VM = 'b'.repeat(64);

describe('relayList', () => {
	it('takes wss URLs and multiaddrs, one per line or comma', () => {
		expect(relayList(`wss://relay.example.com/attest\n/dns4/relay.example.com/tcp/443/tls/ws/p2p/${PEER}, ws://127.0.0.1:8787/attest`)).toEqual([
			'wss://relay.example.com/attest',
			`/dns4/relay.example.com/tcp/443/tls/ws/p2p/${PEER}`,
			'ws://127.0.0.1:8787/attest'
		]);
	});
	it('refuses anything else', () => {
		expect(() => relayList('https://relay.example.com/attest')).toThrow(/Kein Relay/);
		expect(() => relayList('ws://relay.example.com/attest')).toThrow(/Kein Relay/);
		expect(() => relayList('/dns4/relay.example.com/tcp/443/tls/ws')).toThrow(/Kein Relay/);
	});
});

describe('relayTransports', () => {
	it('hands each attempt to the next relay', () => {
		const opened = [];
		class FakeSocket {
			constructor(url) {
				opened.push(url);
			}
			addEventListener() {}
		}
		const original = globalThis.WebSocket;
		globalThis.WebSocket = FakeSocket;
		const next = relayTransports(['wss://one.example.com/attest', 'wss://two.example.com/attest']);
		next(`wss://one.example.com/attest?crn=${CRN}&vm=${VM}`);
		next(`wss://one.example.com/attest?crn=${CRN}&vm=${VM}`);
		next(`wss://one.example.com/attest?crn=${CRN}&vm=${VM}`);
		expect(opened).toEqual([
			`wss://one.example.com/attest?crn=${CRN}&vm=${VM}`,
			`wss://two.example.com/attest?crn=${CRN}&vm=${VM}`,
			`wss://one.example.com/attest?crn=${CRN}&vm=${VM}`
		]);
		globalThis.WebSocket = original;
	});
});

describe('libp2pTransport', () => {
	/** A relay that answers the attest protocol: checks the header, then echoes the bytes reversed. */
	let relay;
	const headers = [];
	beforeAll(async () => {
		relay = await createLibp2p({ addresses: { listen: ['/ip4/127.0.0.1/tcp/0/ws'] }, transports: [webSockets()], connectionEncrypters: [noise()], streamMuxers: [yamux()] });
		await relay.handle(ATTEST_PROTOCOL, (stream) => {
			(async () => {
				let header = true;
				for await (const chunk of stream) {
					let bytes = chunk.subarray();
					if (header) {
						const newline = bytes.indexOf(10);
						headers.push(JSON.parse(new TextDecoder().decode(bytes.subarray(0, newline))));
						bytes = bytes.subarray(newline + 1);
						header = false;
						if (!bytes.length) continue;
					}
					stream.send(Uint8Array.from(bytes).reverse());
				}
			})();
		});
	});
	afterAll(() => relay.stop());

	it('names the target, then carries bytes both ways', async () => {
		const transport = libp2pTransport(relay.getMultiaddrs()[0].toString(), { crn: CRN, vm: VM });
		const received = [];
		transport.onData((bytes) => received.push(new TextDecoder().decode(bytes)));
		await transport.opened;
		transport.send(new TextEncoder().encode('hello'));
		await expect.poll(() => received.join('')).toBe('olleh');
		expect(headers.at(-1)).toEqual({ crn: CRN, vm: VM });
		transport.close();
	});

	it('reports a relay that cannot be reached as closed', async () => {
		const transport = libp2pTransport(`/ip4/127.0.0.1/tcp/1/ws/p2p/${PEER}`, { crn: CRN, vm: VM });
		let closed = false;
		transport.onClose(() => (closed = true));
		await expect(transport.opened).rejects.toThrow(/closed/);
		expect(closed).toBe(true);
	});
});
