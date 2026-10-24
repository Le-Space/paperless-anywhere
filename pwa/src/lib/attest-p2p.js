// Attest relays: a wss:// URL (the relay's WebSocket route) or a libp2p
// multiaddr of an orbitdb-relay that speaks /le-space/attest/1.0.0
// (NiKrause/relay-button#200), reached over WebSockets with AutoTLS or
// WebRTC-Direct, with no domain of the relay's own. Either way the relay
// carries the RA-TLS records the WASM in this browser checks; it cannot read
// them. js-libp2p is loaded only when a multiaddr relay is used.
import { websocketTransport } from '@le-space/attest-wasm/ratls';

export const ATTEST_PROTOCOL = '/le-space/attest/1.0.0';
const DIAL_TIMEOUT_MS = 20_000;

const WSS = /^(wss:\/\/[A-Za-z0-9.-]+(:[0-9]+)?|ws:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?)\/attest$/;
// A multiaddr ending in the relay's peer id (needed to dial it securely).
const MULTIADDR = /^\/(ip4|ip6|dns4|dns6|dns)\/[^\s]+\/p2p\/[1-9A-HJ-NP-Za-km-z]{46,}$/;

/** The relays in a setting, one per line or comma; throws on an entry that is neither. @param {string} text */
export function relayList(text) {
	const entries = String(text ?? '').split(/[\s,]+/).map((e) => e.trim()).filter(Boolean);
	for (const entry of entries) {
		if (!WSS.test(entry) && !MULTIADDR.test(entry)) throw new Error(`Kein Relay: ${entry.slice(0, 60)} (erwartet: wss://<host>/attest oder eine Multiaddr mit /p2p/)`);
	}
	return entries;
}

export const isMultiaddr = (/** @type {string} */ relay) => relay.startsWith('/');

let nodePromise = null;
/** One small libp2p node per page: no listening, no discovery, dial only. */
function browserNode() {
	nodePromise ??= (async () => {
		const [{ createLibp2p }, { webSockets }, { noise }, { yamux }, { identify }] = await Promise.all([
			import('libp2p'),
			import('@libp2p/websockets'),
			import('@chainsafe/libp2p-noise'),
			import('@chainsafe/libp2p-yamux'),
			import('@libp2p/identify')
		]);
		// WebRTC-Direct where the browser has WebRTC (not in Node tests).
		const webrtc = typeof globalThis.RTCPeerConnection === 'function' ? [(await import('@libp2p/webrtc')).webRTCDirect()] : [];
		return createLibp2p({
			addresses: { listen: [] },
			transports: [webSockets(), ...webrtc],
			connectionEncrypters: [noise()],
			streamMuxers: [yamux()],
			services: { identify: identify() },
			// Only the relays the person entered are dialled.
			connectionGater: { denyDialMultiaddr: () => false }
		});
	})();
	return nodePromise;
}

/**
 * A transport (the shape attest-wasm's websocketTransport has) over a libp2p
 * stream to `relay` for instance `vm` on node `crn`. Failures read as
 * "closed", so unlockInstance retries them like a guest not answering yet.
 * @param {string} relay @param {{ crn: string, vm: string }} target
 */
export function libp2pTransport(relay, { crn, vm }) {
	const dataCallbacks = [];
	const closeCallbacks = [];
	let stream = null;
	let closed = false;
	const fireClose = () => {
		if (closed) return;
		closed = true;
		for (const callback of closeCallbacks) callback();
	};
	const opened = (async () => {
		try {
			const [{ multiaddr }, node] = await Promise.all([import('@multiformats/multiaddr'), browserNode()]);
			stream = await node.dialProtocol(multiaddr(relay), ATTEST_PROTOCOL, { signal: AbortSignal.timeout(DIAL_TIMEOUT_MS) });
		} catch (error) {
			fireClose();
			throw new Error(`connection to the relay closed: ${error instanceof Error ? error.message : String(error)}`);
		}
		stream.send(new TextEncoder().encode(`${JSON.stringify({ crn, vm })}\n`));
		(async () => {
			try {
				for await (const chunk of stream) {
					const bytes = chunk instanceof Uint8Array ? chunk : chunk.subarray();
					for (const callback of dataCallbacks) callback(bytes);
				}
			} catch {
				// the relay or the guest went away
			}
			fireClose();
		})();
	})();
	opened.catch(() => {});
	return {
		opened,
		send: (/** @type {Uint8Array} */ bytes) => {
			if (stream && !closed) stream.send(bytes);
		},
		onData: (callback) => dataCallbacks.push(callback),
		onClose: (callback) => closeCallbacks.push(callback),
		close: () => {
			stream?.close().catch(() => stream?.abort?.(new Error('closed')));
			fireClose();
		}
	};
}

/**
 * The transport factory for attest-wasm (`unlockInstance`'s `transport`, which
 * calls it with `<relay>?crn=…&vm=…`): the relays in turn, one per attempt, so
 * a relay that is down hands the next attempt to the next one.
 * @param {string[]} relays
 */
export function relayTransports(relays) {
	let attempt = 0;
	return (/** @type {string} */ url) => {
		const query = new URLSearchParams(url.slice(url.indexOf('?') + 1));
		const crn = query.get('crn') ?? '';
		const vm = query.get('vm') ?? '';
		const relay = relays[attempt++ % relays.length];
		return isMultiaddr(relay) ? libp2pTransport(relay, { crn, vm }) : websocketTransport(`${relay}?crn=${crn}&vm=${vm}`);
	};
}
