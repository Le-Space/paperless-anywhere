// One place for "the balances are stale": a round counter every balance
// display and check depends on (Balances, Package, Setup, Lifecycle). A new
// round reads everything again: the button "Kontostand neu laden", a "no"
// message's "check again", the return from a payment, a change of who pays,
// and the window coming back into view (at most every 30 s). Within a round a
// read is shared (onceThisRound), so the displays agree with each other.
import { get, writable } from 'svelte/store';

export const balancesRound = writable(0);
export const AUTO_MIN_MS = 30_000;
let last = 0;

/** Read every balance again, now. */
export function refreshBalances(now = Date.now()) {
	last = now;
	balancesRound.update((n) => n + 1);
}

/** Read again unless that happened in the last 30 s (focus, coming back into view). */
export function refreshBalancesSoon(now = Date.now()) {
	if (now - last < AUTO_MIN_MS) return false;
	refreshBalances(now);
	return true;
}

/** @type {Map<string, Promise<any>>} */
const shared = new Map();
/**
 * `read()` once in this round for `key`; a failure is not kept.
 * @template T @param {string} key @param {() => Promise<T>} read @returns {Promise<T>}
 */
export function onceThisRound(key, read) {
	const round = get(balancesRound);
	const k = `${round}|${key}`;
	for (const old of shared.keys()) if (!old.startsWith(`${round}|`)) shared.delete(old);
	let p = shared.get(k);
	if (!p) {
		p = read().catch((e) => {
			shared.delete(k);
			throw e;
		});
		shared.set(k, p);
	}
	return p;
}
