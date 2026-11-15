// #202, the build paid by the package, end to end on mainnet with a test
// vault that holds a Le Space plan: the app's own code (credits.js,
// own-image.js) asks the price, has the service charge and grant the
// sub-account, has the builder fixed in the app seal the image for that
// vault, fetches it through Le Space's relays, stores it for the sub-account,
// tells the service the build is over, and forgets the image's STORE again.
//
//   PACKAGE_PHRASE="<24 words>" VITE_CREDITS_URL=https://credits.le-space.de \
//     [PACKAGE_PLAN=paperless-15-backup] [PACKAGE_RESULT=file] \
//     pnpm exec vite-node scripts/own-image-package.mjs
//
// PACKAGE_PLAN chooses that plan first (PUT /v1/package), paid from the
// balance. The words, the master secret and the image's passphrase are never
// printed; the result names the build, the charge, the grant, what came back
// and how long each step took.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { attestGuest } from '@le-space/attest-wasm/ratls';
import * as wasm from '@le-space/attest-wasm/pkg/relay_button_attest.js';
import { ALEPH_API, readAggregate } from '../src/lib/aleph.js';
import { alephPrivateKey } from '../src/lib/keys/derive.js';
import { sealingKeyFromSeedPhrase, unseal } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { choosePlan, IMAGE_BUILD_TYPES, imageBuild, imageBuildDone, vmAuthorize } from '../src/lib/credits.js';
import { BUILDER, buildPaidByPackage, builderOpener, forgetBuilder } from '../src/lib/own-image.js';
import { relayTransports } from '../src/lib/attest-p2p.js';
import { findAttestRelays } from '../src/lib/relays.js';

const { PACKAGE_PHRASE = '', PACKAGE_PLAN = '', PACKAGE_RESULT = '' } = process.env;
const phrase = PACKAGE_PHRASE.trim().split(/\s+/).join(' ');
if (phrase.split(' ').length !== 24) throw new Error('PACKAGE_PHRASE: 24 words');

const t0 = Date.now();
const at = () => Math.round((Date.now() - t0) / 1000);
const result = { steps: {} };
const step = (name) => ((result.steps[name] ??= at()), console.log(at(), 's', name));
const statusOf = async (hash) => (await (await fetch(`${ALEPH_API}/api/v0/messages/${hash}`, { cache: 'no-store' }).catch(() => null))?.json().catch(() => null))?.status ?? null;

try {
	const remote = await readAggregate(seedIndexAccount(phrase).address, VAULT_KEY);
	if (!remote?.box) throw new Error('no vault for these words on Aleph');
	const master = await unseal(remote.box, sealingKeyFromSeedPhrase(phrase), 'master/seed');
	const app = privateKeyToAccount(alephPrivateKey(master));
	result.account = app.address;

	if (PACKAGE_PLAN) {
		step('plan');
		result.plan = await choosePlan(master, PACKAGE_PLAN);
	}
	step('authorize');
	const granted = await vmAuthorize(master);
	result.owner = granted.owner;
	result.types = granted.types;
	if (!granted.types || !IMAGE_BUILD_TYPES.every((t) => granted.types?.includes(t))) throw new Error(`the grant lacks ${IMAGE_BUILD_TYPES.join(', ')}`);
	step('quote');
	result.quote = await imageBuild(master, { quote: true });

	const pkg = dirname(createRequire(import.meta.url).resolve('@le-space/attest-wasm/pkg/relay_button_attest.js'));
	await wasm.default({ module_or_path: await readFile(join(pkg, 'relay_button_attest_bg.wasm')) });
	const relays = await findAttestRelays();
	const load = async () => ({ attestGuest, relayTransports, relays, wasm });

	let shown = '';
	const built = await buildPaidByPackage({
		master,
		app,
		builder: /** @type {any} */ (BUILDER),
		opener: (running) => builderOpener(running, {}, { load }),
		charge: async () => {
			step('charge');
			const c = await imageBuild(master);
			result.build = { buildId: c.buildId, alephCredits: c.alephCredits, chargedCredits: c.chargedCredits, creditsBefore: c.creditsBefore, creditsAfter: c.creditsAfter };
			return c;
		},
		done: async (d) => {
			step('done');
			result.done = { sent: { failed: Boolean(d.failed), program: d.program ?? null }, ...(await imageBuildDone(master, d)) };
		},
		onStarted: (vprogram) => void (result.vprogram = vprogram),
		onProgress: ({ step: s, detail }) => {
			const line = s === 'fetch' ? `fetch ${String(detail).match(/\((\d+) %\)/)?.[1]?.replace(/\d$/, '0') ?? ''} %` : s;
			if (line !== shown) step(line), (shown = line);
		}
	});
	result.store = built.rootfsItemHash;
	result.storeStatus = await statusOf(built.rootfsItemHash);
	result.vprogramStatus = result.vprogram ? await statusOf(result.vprogram) : null;

	// The image was only built to be measured: forgotten again, in the sub-account's name.
	step('forget image');
	result.storeForgotten = await forgetBuilder(app, built.rootfsItemHash, { payer: granted.owner });
} catch (error) {
	result.error = String(error?.message ?? error).slice(0, 300);
} finally {
	result.seconds = at();
	console.log(JSON.stringify(result, null, 1));
	if (PACKAGE_RESULT) await writeFile(PACKAGE_RESULT, JSON.stringify(result, null, 1));
}
process.exit(result.error ? 1 : 0);
