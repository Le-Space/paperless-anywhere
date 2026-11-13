// The app's language (the app under /app/; the landing page has its own
// catalogue in landing/i18n.js). One store holds it; every text a person
// reads comes from a catalogue file in this folder, German and English with
// the same keys (catalogue.spec.js checks that, no-german.spec.js that no
// German text is left outside).
//
// A component reads `$t.<area>.<key>` and follows a change at once, so the
// switch in the header needs no reload (the vault stays open). A plain module
// asks `tr()` at the moment it needs a text, for example when it throws.
import { derived, get, writable } from 'svelte/store';
import { app } from './app.js';
import { life } from './lifecycle.js';

/** @typedef {'de' | 'en'} Lang */
export const LANGS = /** @type {const} */ (['de', 'en']);
const KEY = 'paperless-lang';

/**
 * The language to start with: the one chosen last, on the landing page or
 * here (someone coming from /en/ sees English). German without a choice, as
 * the landing page at / is German for everyone.
 * @returns {Lang}
 */
export function savedLang() {
	try {
		return globalThis.localStorage?.getItem(KEY) === 'en' ? 'en' : 'de';
	} catch {
		return 'de';
	}
}

/** @type {import('svelte/store').Writable<Lang>} */
export const lang = writable(savedLang());

/** Choose a language: remembered in this browser, applied at once. @param {Lang} next */
export function setLang(next) {
	if (!LANGS.includes(next)) return;
	try {
		globalThis.localStorage?.setItem(KEY, next);
	} catch {
		/* not remembered */
	}
	lang.set(next);
}

/** Every area's texts, by language. A new area is added here once. */
export const catalogue = { de: { app: app.de, life: life.de }, en: { app: app.en, life: life.en } };

/** The texts in the current language, for a component: `$t.app.lock`. */
export const t = derived(lang, ($lang) => catalogue[$lang]);
/** The texts in the current language, for a plain module, asked when needed. */
export const tr = () => catalogue[get(lang)];
/** The current language, for a plain module. @returns {Lang} */
export const currentLang = () => get(lang);

/** The locale for dates and numbers. @param {Lang} [l] */
export const localeOf = (l = get(lang)) => (l === 'de' ? 'de-DE' : 'en-GB');

/**
 * Dates, numbers and money in the current language. Each takes the language
 * as its last argument, so a component can pass `$lang` and follow a change.
 */
export const format = {
	/** @param {string | number | Date} at @param {Intl.DateTimeFormatOptions} [options] @param {Lang} [l] */
	date: (at, options = { day: '2-digit', month: '2-digit', year: 'numeric' }, l) => new Date(at).toLocaleDateString(localeOf(l), options),
	/** @param {string | number | Date} at @param {Intl.DateTimeFormatOptions} [options] @param {Lang} [l] */
	dateTime: (at, options = { dateStyle: 'medium', timeStyle: 'short' }, l) => new Date(at).toLocaleString(localeOf(l), options),
	/** @param {number} n @param {Intl.NumberFormatOptions} [options] @param {Lang} [l] */
	number: (n, options, l) => n.toLocaleString(localeOf(l), options),
	/** Euros with cents, from cents: "4,90 €" / "€4.90". @param {number} cents @param {Lang} [l] */
	euro: (cents, l = get(lang)) => {
		// Written out, not Intl's currency style: that puts a no-break space in German, which no text in the app has.
		const amount = (cents / 100).toLocaleString(localeOf(l), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		return l === 'de' ? `${amount} €` : `€${amount}`;
	}
};
