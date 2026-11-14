// "Mein Image bauen" in Chromium, as the setup does it (#202, before the
// release): the page loads the app's own modules and calls buildOnOwnBuilder
// with the builder fixed in the app (BUILDER). That starts a builder for this
// build, attests it through Le Space's relays, has it seal the image for a
// throwaway vault, fetches the sealed image back, uploads it to Aleph from
// the page and forgets the builder again.
//
// BUILD_KEY pays (the V-PROGRAM and the STORE) and signs, in Node: the page
// asks for each signature (exposed function), so the key never enters it.
// The image's passphrase goes to PASSPHRASE_FILE (mode 600) for the round
// trip's VMs; it is never printed. BUILD_RESULT names a file for the result.
// The STORE stays: the round trip's cleanup forgets it after the VMs.
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { ALEPH_API } from '../src/lib/aleph.js';

const KEY = (process.env.BUILD_KEY ?? '').trim();
const PASSPHRASE_FILE = process.env.PASSPHRASE_FILE ?? '';
const RESULT = process.env.BUILD_RESULT ?? '';

const statusOf = async (hash) => (await (await fetch(`${ALEPH_API}/api/v0/messages/${hash}`, { cache: 'no-store' }).catch(() => null))?.json().catch(() => null))?.status ?? null;

test('an image of its own, built in a browser with the builder fixed in the app', async ({ page }) => {
	test.skip(!KEY || !PASSPHRASE_FILE, 'needs BUILD_KEY and PASSPHRASE_FILE');
	const account = privateKeyToAccount(/** @type {`0x${string}`} */ (KEY.startsWith('0x') ? KEY : `0x${KEY}`));
	await page.exposeFunction('__sign', (message) => account.signMessage({ message }));
	page.on('console', (m) => {
		if (m.type() === 'error' || /^\d+ s /.test(m.text())) console.log('page:', m.text().slice(0, 200));
	});
	await page.goto('/');
	const t0 = Date.now();
	const result = { from: 'browser', address: account.address };
	try {
		const built = await page.evaluate(async (address) => {
			const { BUILDER, buildOnOwnBuilder, builderOpener } = await import('/src/lib/own-image.js');
			const steps = {};
			const started = Date.now();
			let vprogram = null;
			let forgotten = false;
			let shown = '';
			try {
				const out = await buildOnOwnBuilder({
					master: crypto.getRandomValues(new Uint8Array(32)),
					app: { address, signMessage: ({ message }) => /** @type {any} */ (globalThis).__sign(message) },
					builder: /** @type {any} */ (BUILDER),
					opener: (running) => builderOpener(running, {}),
					onProgress: ({ step, detail }) => {
						steps[step] ??= Math.round((Date.now() - started) / 1000);
						const line = step === 'fetch' ? String(detail).replace(/\d(?= %)/, '0') : step;
						if (line !== shown) console.log(`${Math.round((Date.now() - started) / 1000)} s ${line}`), (shown = line);
					},
					onStarted: (v) => void (vprogram = v),
					onForgotten: () => void (forgotten = true)
				});
				return { store: out.rootfsItemHash, passphrase: out.luksPassphrase, measurement: out.ownImage.builder?.measurement ?? null, steps, vprogram, forgotten };
			} catch (error) {
				return { error: String(error?.message ?? error).slice(0, 300), steps, vprogram, forgotten };
			}
		}, account.address);
		result.seconds = Math.round((Date.now() - t0) / 1000);
		result.steps = built.steps;
		result.vprogram = built.vprogram;
		result.builderForgotten = built.forgotten;
		if (built.vprogram) result.vprogramStatus = await statusOf(built.vprogram);
		if (built.error) result.error = built.error;
		expect(built.error, 'the build').toBeUndefined();
		result.store = built.store;
		result.measurement = built.measurement;
		result.storeStatus = await statusOf(built.store);
		await writeFile(PASSPHRASE_FILE, built.passphrase, { mode: 0o600 });
		expect(result.storeStatus).toBe('processed');
		expect(built.forgotten, 'the builder is forgotten').toBe(true);
	} finally {
		console.log(JSON.stringify(result, null, 1));
		if (RESULT) await writeFile(RESULT, JSON.stringify(result, null, 1));
	}
});
