import { describe, expect, it, vi } from 'vitest';
import { CreditsShortError, QuoteUnsupportedError } from './credits.js';
import { hourPurchase, purchaseLocked } from './purchase.js';

// Made-up figures; the quote's shape is quoteVm's.
const QUOTE = { hours: 10, alephCredits: 570000, chargedCredits: 77, expiration: '2026-12-08T00:00:00.000Z', to: null, creditsBefore: 2000, creditsAfter: 1923, hoursBefore: 0, hoursAfter: 10 };

const setup = (/** @type {Partial<{ quote: any, buy: any }>} */ over = {}) => {
	const quote = vi.fn(over.quote ?? (async () => QUOTE));
	const buy = vi.fn(over.buy ?? (async () => 'bought'));
	const states = /** @type {any[]} */ ([]);
	const support = { blocked: '' };
	const p = hourPurchase({ quote, buy, onchange: (s) => states.push(s), support });
	return { p, quote, buy, states, support };
};

describe('one VM-hour purchase, only after a confirmation', () => {
	it('asks for a quote first and buys nothing until confirmed', async () => {
		const { p, quote, buy, states } = setup();
		await p.ask(10);
		expect(quote).toHaveBeenCalledWith(10);
		expect(buy).not.toHaveBeenCalled();
		expect(states.map((s) => s.phase)).toEqual(['quoting', 'open']);
		expect(p.state.quote).toBe(QUOTE);
		expect(purchaseLocked(p.state)).toBe(true);
	});

	it('buys exactly once on confirm, with the quoted hours, and closes', async () => {
		const { p, buy } = setup();
		await p.ask(10);
		const r = await Promise.all([p.confirm(), p.confirm(), p.confirm()]);
		expect(buy).toHaveBeenCalledTimes(1);
		expect(buy).toHaveBeenCalledWith(10, QUOTE);
		expect(r[0]).toBe('bought');
		expect(p.state.phase).toBe('idle');
		expect(await p.confirm()).toBeUndefined();
		expect(buy).toHaveBeenCalledTimes(1);
	});

	it('buys nothing on cancel, and a new attempt asks a new quote', async () => {
		const { p, quote, buy } = setup();
		await p.ask(10);
		p.cancel();
		expect(p.state).toEqual({ phase: 'idle', hours: null, quote: null, error: '' });
		await p.confirm();
		expect(buy).not.toHaveBeenCalled();
		await p.ask(5);
		expect(quote).toHaveBeenCalledTimes(2);
		expect(quote).toHaveBeenLastCalledWith(5);
	});

	it('asks one quote at a time: clicks while it is pending or open do nothing', async () => {
		/** @type {(q: any) => void} */
		let answer = () => {};
		const { p, quote } = setup({ quote: () => new Promise((r) => (answer = r)) });
		const first = p.ask(10);
		await p.ask(30);
		expect(quote).toHaveBeenCalledTimes(1);
		answer(QUOTE);
		await first;
		await p.ask(5);
		expect(quote).toHaveBeenCalledTimes(1);
		expect(p.state.hours).toBe(10);
	});

	it('shows a failed purchase, closes, and never retries it', async () => {
		const { p, buy } = setup({ buy: async () => { throw new Error('Stunden sind schon unterwegs, bitte kurz warten.'); } });
		await p.ask(10);
		expect(await p.confirm()).toBeUndefined();
		expect(buy).toHaveBeenCalledTimes(1);
		expect(p.state).toMatchObject({ phase: 'idle', quote: null, error: 'Stunden sind schon unterwegs, bitte kurz warten.' });
		await p.confirm();
		expect(buy).toHaveBeenCalledTimes(1);
	});

	it('shows a short balance in the confirmation, with nothing to buy', async () => {
		const { p, buy } = setup({ quote: async () => { throw new CreditsShortError('Die Le Space Credits reichen dafür nicht. Erst aufladen.', null); } });
		await p.ask(30);
		expect(p.state).toMatchObject({ phase: 'short', hours: 30, quote: null });
		await p.confirm();
		expect(buy).not.toHaveBeenCalled();
		p.cancel();
		expect(p.state.phase).toBe('idle');
	});

	it('after an older service answered like a purchase, asks no quote again and never buys', async () => {
		const { p, quote, buy, support } = setup({ quote: async () => { throw new QuoteUnsupportedError({ transfer_id: 't9', charged_credits: 77 }); } });
		await p.ask(10);
		expect(p.state.phase).toBe('idle');
		expect(p.state.error).toMatch(/womöglich schon gekauft/);
		expect(support.blocked).toBe(p.state.error);
		await p.ask(10);
		expect(quote).toHaveBeenCalledTimes(1);
		expect(buy).not.toHaveBeenCalled();
	});

	it('shows any other quote error and stays ready for a new attempt', async () => {
		const { p, buy } = setup({ quote: async () => { throw new Error('Le Space Credits antwortet 500'); } });
		await p.ask(10);
		expect(p.state).toMatchObject({ phase: 'idle', error: 'Le Space Credits antwortet 500' });
		expect(buy).not.toHaveBeenCalled();
	});
});
