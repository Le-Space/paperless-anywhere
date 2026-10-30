// Diagnosis start (not part of the app): starts a confidential Paperless the
// way the app does, with a fresh vault, and sends a public key as the secret
// authorized_keys, which the confidential init adds for root.
// Prints the SSH command once the VM is unlocked, waits for Paperless, and
// leaves the VM running for inspection: forget it afterwards.
//
//   PAYER_KEY=… LUKS_PASSPHRASE=… RELAY_URL=… ROOTFS_ITEM_HASH=… CRN_HASH=… \
//   SSH_PUBKEY_FILE=~/.ssh/id_ed25519.pub npx vite-node scripts/live-debug-start.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as attestWasm from '@le-space/attest-wasm/pkg/relay_button_attest.js';
import { privateKeyToAccount } from 'viem/accounts';
import { alephPrivateKey } from '../src/lib/keys/derive.js';
import { isAuthorized, readAuthorizations, setAlephAuthorization } from '../src/lib/permissions.js';
import { startPaperless } from '../src/lib/lifecycle.js';
import { crnAddress } from '../src/lib/vm.js';

// In Node the WASM cannot fetch its own file: initialize it from disk first;
// the app's later wasm.default() then finds it ready.
attestWasm.initSync({ module: readFileSync(createRequire(import.meta.url).resolve('@le-space/attest-wasm/pkg/relay_button_attest_bg.wasm')) });

const env = (name) => {
	const v = process.env[name]?.trim();
	if (!v) throw new Error(`set ${name}`);
	return v;
};
const raw = env('PAYER_KEY');
const payer = privateKeyToAccount(raw.startsWith('0x') ? raw : `0x${raw}`);
const sshKey = readFileSync(env('SSH_PUBKEY_FILE'), 'utf8').trim();

// What MetaMask does for the app, signed by the test wallet.
globalThis.ethereum = {
	request: async ({ method, params }) => {
		if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [payer.address];
		if (method === 'personal_sign') return payer.signMessage({ message: { raw: params[0] } });
		throw new Error(`unsupported ${method}`);
	}
};

// Log the item hash of each message sent, so a refusal can be looked up.
const realFetch = globalThis.fetch;
globalThis.fetch = (url, init) => {
	try {
		const body = init?.body && JSON.parse(init.body);
		if (body?.message?.type) console.log(`sent ${body.message.type} ${body.message.item_hash}`);
	} catch {}
	return realFetch(url, init);
};

const master = crypto.getRandomValues(new Uint8Array(32));
const app = privateKeyToAccount(alephPrivateKey(master));
console.log(`app key ${app.address}`);
await setAlephAuthorization(payer.address, app.address);
// Aleph refuses the INSTANCE until it has processed the authorization.
for (let i = 0; i < 60 && !isAuthorized(await readAuthorizations(payer.address), app.address); i++) await new Promise((r) => setTimeout(r, 5000));
console.log('authorized on Aleph');

const profile = {
	payer: payer.address,
	network: 'calibration',
	attestRelay: env('RELAY_URL'),
	rootfsItemHash: env('ROOTFS_ITEM_HASH'),
	crnHash: env('CRN_HASH'),
	luksPassphrase: env('LUKS_PASSPHRASE'),
	debugAuthorizedKeys: sshKey
};

const started = Date.now();
let instance = '';
let printed = false;
const sshCommand = async () => {
	const crn = await crnAddress(profile.crnHash);
	for (const path of ['/v2/about/executions/list', '/about/executions/list']) {
		const res = await fetch(`${crn}${path}`).catch(() => null);
		if (!res?.ok) continue;
		const net = (await res.json())?.[instance]?.networking;
		if (!net) continue;
		const v4 = net.mapped_ports?.['22']?.host ? `ssh -p ${net.mapped_ports['22'].host} root@${net.host_ipv4}` : null;
		const v6 = net.ipv6_ip ? `ssh root@${net.ipv6_ip}` : null;
		return [v4, v6].filter(Boolean).join('   or   ');
	}
	return 'no networking listed';
};
try {
	const running = await startPaperless(master, profile, async ({ step, detail, instanceHash, injected }) => {
		if (instanceHash) instance = instanceHash;
		console.log(`[${Math.round((Date.now() - started) / 1000)} s] ${detail ?? step}`);
		if (injected) console.log(`injected by the agent: ${JSON.stringify(injected)}`);
		if (step === 'ready' && !printed && instance) {
			printed = true;
			console.log(`instance ${instance}`);
			console.log(`SSH: ${await sshCommand()}`);
			// STOP_AFTER_UNLOCK: end here, leaving the VM for its console and a forget.
			if (process.env.STOP_AFTER_UNLOCK) process.exit(0);
		}
	});
	console.log(`Paperless at https://${running.host}/ after ${Math.round((Date.now() - started) / 1000)} s`);
} catch (error) {
	console.log(`start failed: ${error instanceof Error ? error.message : String(error)}`);
	if (instance && !printed) console.log(`instance ${instance}\nSSH: ${await sshCommand()}`);
}
console.log(`left running: forget instance ${instance} when done`);
