// Aleph credits in money. Credits are pegged to the dollar: 1 USD buys
// 1,000,000 credits (Aleph's CLI and docs; `aleph account list` shows the
// same). ALEPH and the dollar in euros come from CoinGecko's public price
// API: a plain GET without anything of the person, kept for ten minutes.
// Without an answer the amounts stay in credits.

export const CREDITS_PER_USD = 1_000_000;
export const PRICES_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=aleph,usd-coin&vs_currencies=eur,usd';
const KEEP_MS = 10 * 60_000;

/** @typedef {{ alephUsd: number, alephEur: number, usdEur: number, at: number }} Prices */

/** @param {any} body @returns {Prices | null} */
export function parsePrices(body, at = Date.now()) {
	const alephUsd = Number(body?.aleph?.usd);
	const alephEur = Number(body?.aleph?.eur);
	const usdc = body?.['usd-coin'];
	const usdEur = Number(usdc?.eur) / Number(usdc?.usd);
	if (![alephUsd, alephEur, usdEur].every((n) => Number.isFinite(n) && n > 0)) return null;
	return { alephUsd, alephEur, usdEur, at };
}

/** @type {Prices | null} */
let kept = null;

/** The current prices, or null when CoinGecko does not answer. @param {{ fetch?: typeof fetch }} [options] */
export async function marketPrices({ fetch: fetchImpl = fetch } = {}) {
	if (kept && Date.now() - kept.at < KEEP_MS) return kept;
	try {
		const res = await fetchImpl(PRICES_URL, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
		if (!res.ok) return kept;
		kept = parsePrices(await res.json()) ?? kept;
	} catch {
		// Keep what we had; the amounts stay in credits without it.
	}
	return kept;
}

/** The units credits can be shown in. */
export const UNITS = /** @type {const} */ (['credits', 'eur', 'usd', 'aleph']);

/**
 * Credits in `unit`, or null without prices (the dollar needs none).
 * @param {number} credits @param {typeof UNITS[number]} unit @param {Prices | null} prices
 */
export function creditsIn(credits, unit, prices) {
	const usd = credits / CREDITS_PER_USD;
	if (unit === 'usd') return usd;
	if (!prices) return null;
	if (unit === 'eur') return usd * prices.usdEur;
	if (unit === 'aleph') return usd / prices.alephUsd;
	return null;
}

/** "≈ 1,38 €", "≈ 1,55 $", "≈ 109,6 ALEPH"; empty for credits or without prices. */
export function money(credits, unit, prices) {
	const value = creditsIn(credits, unit, prices);
	if (value === null || unit === 'credits') return '';
	const digits = unit === 'aleph' ? (value >= 100 ? 0 : 1) : 2;
	const n = value.toLocaleString('de-DE', { minimumFractionDigits: unit === 'aleph' ? 0 : 2, maximumFractionDigits: digits });
	return `≈ ${n} ${unit === 'eur' ? '€' : unit === 'usd' ? '$' : 'ALEPH'}`;
}
