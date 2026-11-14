// Steps 3 and 6 of #202: the app's own code (buildOwnImage, builderOpener) has
// a published builder seal the image for a throwaway vault and fetches it
// back through an attest relay, as a browser would. By default it stops before
// the upload: nothing is stored on Aleph, and the throwaway passphrase is
// forgotten. Run with vite-node from pwa/ (the app's modules as they are):
//
//   VPROGRAM=<hash> CRN=<hash> PLAIN_SHA256=<hex> [RELAY=wss://…/attest] \
//     pnpm exec vite-node scripts/own-image-fetch.mjs
//
// Without RELAY it uses Le Space's relays as the app finds them on Aleph.
// FETCH_RESULT names a file for the result (JSON).
//
// With STORE_KEY (an Aleph key with credits) and PASSPHRASE_FILE it goes on as
// the app does: the key signs the STORE, the image is uploaded and confirmed,
// the result names the STORE (`store`), and the image's passphrase is written
// to PASSPHRASE_FILE (mode 600) for a VM to be unlocked with. It is never
// printed. The STORE costs credits until it is forgotten.
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { attestGuest } from '@le-space/attest-wasm/ratls';
import * as wasm from '@le-space/attest-wasm/pkg/relay_button_attest.js';
import { ALEPH_API } from '../src/lib/aleph.js';
import { buildOwnImage, builderOpener, storeOnAleph } from '../src/lib/own-image.js';
import { relayList, relayTransports } from '../src/lib/attest-p2p.js';
import { findAttestRelays } from '../src/lib/relays.js';

const HEX64 = /^[0-9a-f]{64}$/;
const { VPROGRAM = '', CRN = '', PLAIN_SHA256 = '', RELAY = '', FETCH_RESULT = '', STORE_KEY = '', PASSPHRASE_FILE = '' } = process.env;
const storing = Boolean(STORE_KEY.trim());
if (storing && !PASSPHRASE_FILE) throw new Error('STORE_KEY needs PASSPHRASE_FILE');
for (const [name, value] of Object.entries({ VPROGRAM, CRN, PLAIN_SHA256 })) if (!HEX64.test(value)) throw new Error(`${name}: 64 hex`);

const pkg = dirname(createRequire(import.meta.url).resolve('@le-space/attest-wasm/pkg/relay_button_attest.js'));
await wasm.default({ module_or_path: await readFile(join(pkg, 'relay_button_attest_bg.wasm')) });

// What the builder must show: the measurements and policy its V-PROGRAM message pins.
const message = await (await fetch(`${ALEPH_API}/api/v0/messages/${VPROGRAM}`)).json();
const verification = message?.message?.content?.verification;
const measurements = (verification?.measurements ?? []).map((m) => m?.registers?.launch).filter((m) => /^[0-9a-f]{96}$/.test(m ?? ''));
if (message?.status !== 'processed' || !measurements.length) throw new Error(`${VPROGRAM} is no processed V-PROGRAM with measurements (${message?.status})`);
const builder = { route: `?crn=${CRN}&vm=${VPROGRAM}`, measurements, policy: verification.policy, vprogram: VPROGRAM, plain: { sha256: PLAIN_SHA256 } };

const t0 = Date.now();
const at = () => Math.round((Date.now() - t0) / 100) / 10;
const relays = RELAY ? relayList(RELAY) : await findAttestRelays();
if (!relays.length) throw new Error('no attest relay');
const result = { relays: relays.length, relay: RELAY ? 'given' : 'Le Space', stored: storing, steps: {}, connections: 0, failedOpens: 0 };
console.log(at(), 'relays', relays.length);

const attestMs = [];
const inner = builderOpener(builder, {}, { load: async () => ({ attestGuest, relayTransports, relays, wasm }) });
const open = async () => {
	const started = Date.now();
	try {
		const channel = await inner();
		result.connections++;
		attestMs.push(Date.now() - started);
		return channel;
	} catch (error) {
		result.failedOpens++;
		console.log(at(), 'open failed:', String(error?.message ?? error).slice(0, 160));
		throw error;
	}
};

let fetchStarted = 0;
let shown = '';
const STOP = new Error('stopped before the upload');
const key = STORE_KEY.trim();
const app = privateKeyToAccount(storing ? (key.startsWith('0x') ? key : `0x${key}`) : `0x${randomBytes(32).toString('hex')}`);
try {
	const built = await buildOwnImage({
		master: randomBytes(32),
		app,
		builder,
		open,
		onProgress: ({ step, detail }) => {
			result.steps[step] ??= at();
			if (step === 'fetch' && !fetchStarted) fetchStarted = Date.now();
			const percent = Number(detail?.match(/\((\d+) %\)/)?.[1] ?? 0);
			const line = step === 'fetch' ? `fetch ${Math.floor(percent / 10) * 10} %` : step;
			if (line !== shown) console.log(at(), line, `(connections ${result.connections}, failed ${result.failedOpens})`), (shown = line);
		},
		store: async (image, message) => {
			const bytes = new Uint8Array(await image.arrayBuffer());
			result.fetched = { mib: Math.round(bytes.length / 1048576), luks: new TextDecoder().decode(bytes.slice(0, 4)) === 'LUKS', sha256: createHash('sha256').update(bytes).digest('hex') };
			if (!storing) throw STOP;
			const started = Date.now();
			const stored = await storeOnAleph(image, message);
			result.uploadSeconds = Math.round((Date.now() - started) / 100) / 10;
			if (stored.reason) result.uploadRefused = stored.reason;
			return stored;
		},
		kept: { current: null }
	});
	if (storing) {
		await writeFile(PASSPHRASE_FILE, built.luksPassphrase, { mode: 0o600 });
		result.store = built.rootfsItemHash;
	}
} catch (error) {
	if (error !== STOP) result.error = String(error?.message ?? error).slice(0, 300);
}
if (fetchStarted) result.fetchSeconds = Math.round((Date.now() - fetchStarted) / 100) / 10;
if (result.fetched && result.fetchSeconds) result.mibPerSecond = Math.round((result.fetched.mib / result.fetchSeconds) * 100) / 100;
const sorted = attestMs.sort((a, b) => a - b);
if (sorted.length) result.attestMs = { median: sorted[Math.floor(sorted.length / 2)], p90: sorted[Math.floor(sorted.length * 0.9)], max: sorted.at(-1) };
result.totalSeconds = at();
console.log(JSON.stringify(result, null, 1));
if (FETCH_RESULT) await writeFile(FETCH_RESULT, JSON.stringify(result, null, 1));
process.exit(result.fetched && (!storing || result.store) ? 0 : 1);
