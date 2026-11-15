// The attest WASM (about 2.4 MB) and what a broken connection looks like.
//
// The WASM comes from the same gateway as the app and can take several
// seconds; a network change on the way (VPN, Wi-Fi) aborts it with a raw
// browser error. So it is loaded once per page, tried again on a network
// error, and can be fetched ahead in the background (preloadAttestWasm), so a
// start does not wait for it. wasm-bindgen's init keeps nothing after a failed
// fetch, so calling it again fetches the file anew.

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

async function importAndInit() {
	const wasm = await import('@le-space/attest-wasm/pkg/relay_button_attest.js');
	await wasm.default();
	return wasm;
}

// Browsers word a broken connection differently; these are the ones seen so
// far (Chrome, Firefox, Safari), plus the WASM compile that lost its body.
const NETWORK =
	/failed to fetch|networkerror|network error|network changed|err_network|err_internet|load failed|body loading was aborted|connection (was )?(reset|closed|lost)|the network connection was lost|importing a module script failed|failed to fetch dynamically imported module/i;

/**
 * Whether `e` is a broken or changed connection rather than an answer.
 * @param {unknown} e
 */
export function isNetworkError(e) {
	if (!e) return false;
	const err = /** @type {any} */ (e);
	const text = `${err.name ?? ''} ${err.message ?? String(e)} ${err.cause?.message ?? ''}`;
	return NETWORK.test(text);
}

/** @type {Promise<any> | null} */
let loading = null;

/**
 * The initialised attest WASM module, loaded once per page and tried again
 * (`tries` in all, with a growing pause) when the connection breaks. A
 * failure is not kept: the next call loads again.
 * @param {{ tries?: number, pauseMs?: number, load?: () => Promise<any>, wait?: (ms: number) => Promise<unknown> }} [o]
 */
export function loadAttestWasm({ tries = 3, pauseMs = 1500, load = importAndInit, wait = sleep } = {}) {
	loading ??= (async () => {
		let last;
		for (let i = 0; i < tries; i++) {
			if (i) await wait(pauseMs * i);
			try {
				return await load();
			} catch (e) {
				last = e;
				if (!isNetworkError(e)) break;
			}
		}
		throw last;
	})().catch((e) => {
		loading = null;
		throw e;
	});
	return loading;
}

/** Fetch the WASM ahead, quietly; a start later uses it or loads again. */
export function preloadAttestWasm(/** @type {Parameters<typeof loadAttestWasm>[0]} */ o) {
	loadAttestWasm(o).catch(() => {});
}

/** For tests: forget the loaded module. */
export function resetAttestWasm() {
	loading = null;
}
