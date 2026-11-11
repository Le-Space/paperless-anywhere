// One VM-hour purchase at a time, and never without a confirmation: a click
// first asks the service what the hours cost (a quote, nothing charged), the
// person sees it and confirms, and only the confirmation buys – exactly once.
// Nothing here retries a purchase. A failed purchase closes the offer; a new
// attempt starts with a new quote.
import { CreditsShortError, QuoteUnsupportedError } from './credits.js';

/**
 * Once the service answered a quote like a purchase (an older service), no
 * further quote is asked in this page: each would buy again.
 */
export const quoteSupport = { blocked: '' };

/**
 * `short`: the quote said the balance does not cover the hours (402); the
 * confirmation shows that, with a pointer to topping up, and buys nothing.
 * @typedef {{ phase: 'idle' | 'quoting' | 'open' | 'short' | 'buying', hours: number | null, quote: any, error: string }} PurchaseState
 */

/**
 * @template T
 * @param {{
 *   quote: (hours: number) => Promise<any>,
 *   buy: (hours: number, quote: any) => Promise<T>,
 *   onchange?: (s: PurchaseState) => void,
 *   onquotefailed?: (e: unknown) => void,
 *   support?: { blocked: string }
 * }} options
 */
export function hourPurchase({ quote, buy, onchange = () => {}, onquotefailed = () => {}, support = quoteSupport }) {
	/** @type {PurchaseState} */
	let s = { phase: 'idle', hours: null, quote: null, error: '' };
	const set = (/** @type {Partial<PurchaseState>} */ patch) => {
		s = { ...s, ...patch };
		onchange(s);
	};
	const message = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));
	return {
		get state() {
			return s;
		},
		/** Ask what `hours` cost; opens the confirmation. @param {number} hours */
		async ask(hours) {
			if (s.phase !== 'idle') return;
			if (support.blocked) return set({ error: support.blocked });
			set({ phase: 'quoting', hours, quote: null, error: '' });
			try {
				const q = await quote(hours);
				set({ phase: 'open', quote: q });
			} catch (e) {
				if (e instanceof CreditsShortError) {
					set({ phase: 'short', quote: null, error: '' });
					onquotefailed(e);
					return;
				}
				if (e instanceof QuoteUnsupportedError) support.blocked = e.message;
				set({ phase: 'idle', hours: null, quote: null, error: message(e) });
				onquotefailed(e);
			}
		},
		/** Close the confirmation; buys nothing. */
		cancel() {
			if (s.phase === 'open' || s.phase === 'short') set({ phase: 'idle', hours: null, quote: null, error: '' });
		},
		/**
		 * Buy the quoted hours, once. Resolves with what `buy` answered, or
		 * undefined when there was nothing to confirm or the purchase failed
		 * (its error is in the state).
		 * @returns {Promise<T | undefined>}
		 */
		async confirm() {
			if (s.phase !== 'open' || s.hours == null) return undefined;
			const { hours, quote: q } = s;
			set({ phase: 'buying' });
			try {
				const r = await buy(hours, q);
				set({ phase: 'idle', hours: null, quote: null, error: '' });
				return r;
			} catch (e) {
				set({ phase: 'idle', hours: null, quote: null, error: message(e) });
				return undefined;
			}
		}
	};
}

/** Whether buy buttons and the hours select must be disabled. @param {PurchaseState} s */
export const purchaseLocked = (s) => s.phase !== 'idle';
