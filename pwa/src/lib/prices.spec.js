import { describe, expect, it } from 'vitest';
import { creditsIn, marketPrices, money, parsePrices } from './prices.js';

// Made-up prices: ALEPH at 0.02 $ and 0.018 €, the dollar at 0.9 €.
const body = { aleph: { usd: 0.02, eur: 0.018 }, 'usd-coin': { usd: 1, eur: 0.9 } };
const prices = parsePrices(body, 0);

describe('credits in money', () => {
	it('pegs credits to the dollar and converts with the prices', () => {
		expect(creditsIn(1_500_000, 'usd', null)).toBe(1.5);
		expect(creditsIn(1_500_000, 'eur', prices)).toBeCloseTo(1.35);
		expect(creditsIn(1_500_000, 'aleph', prices)).toBeCloseTo(75);
		expect(creditsIn(1_500_000, 'eur', null)).toBeNull();
	});
	it('formats in German, nothing for credits or without prices', () => {
		expect(money(1_500_000, 'eur', prices)).toBe('≈ 1,35 €');
		expect(money(57_000, 'usd', null)).toBe('≈ 0,06 $');
		expect(money(1_500_000, 'aleph', prices)).toBe('≈ 75 ALEPH');
		expect(money(1_500_000, 'credits', prices)).toBe('');
		expect(money(1_500_000, 'eur', null)).toBe('');
	});
	it('refuses an answer without usable prices', () => {
		expect(parsePrices({ aleph: { usd: 0.02 } })).toBeNull();
		expect(parsePrices(null)).toBeNull();
	});
	it('asks CoinGecko once and keeps the answer', async () => {
		let calls = 0;
		const fetch = async () => (calls++, new Response(JSON.stringify(body)));
		expect((await marketPrices({ fetch }))?.usdEur).toBe(0.9);
		await marketPrices({ fetch });
		expect(calls).toBe(1);
	});
});
