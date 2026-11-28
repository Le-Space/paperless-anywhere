// Installing the web app from the page (Install.svelte). Chromium offers its
// own prompt: it fires `beforeinstallprompt`, which is kept here (and its
// mini-infobar held back) until someone presses "App installieren". Safari and
// Firefox fire nothing; there a short hint says how, once per device unless
// dismissed. Nothing shows in the installed app itself.
//
// The listeners are registered when this module is first imported in the
// browser, so an event that comes before a button exists is not lost.
import { writable } from 'svelte/store';

/** @typedef {'button' | 'ios' | 'mac' | 'firefox' | 'none'} Offer */

/** Where a dismissed hint is remembered on this device (no secret). */
export const DISMISSED_KEY = 'paperless-anywhere.install-hint-dismissed';

/**
 * Which browser family needs which hint, from its user agent. iPadOS calls
 * itself a Mac, and tells itself apart by its touch points.
 * @param {string} ua @param {number} [touchPoints]
 * @returns {'ios' | 'mac' | 'firefox' | 'other'}
 */
export function browserKind(ua, touchPoints = 0) {
	if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
	// Firefox on Android installs from its menu, without an event; no hint there.
	if (/Firefox\//.test(ua) && !/Android/.test(ua)) return 'firefox';
	if (/Macintosh/.test(ua) && /Version\/[\d.]+.*Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|OPR\//.test(ua)) return 'mac';
	return 'other';
}

/**
 * What to offer: the button once the browser's prompt is ready, else the hint
 * of a browser without one, unless dismissed; nothing in the installed app or
 * after an install.
 * @param {{ standalone: boolean, installed: boolean, prompt: boolean, kind: ReturnType<typeof browserKind>, dismissed: boolean }} s
 * @returns {Offer}
 */
export function offer({ standalone, installed, prompt, kind, dismissed }) {
	if (standalone || installed) return 'none';
	if (prompt) return 'button';
	if (kind === 'other' || dismissed) return 'none';
	return kind;
}

/** The browser's kept install prompt, if it gave one. @type {import('svelte/store').Writable<any>} */
export const promptEvent = writable(null);
/** Installed from this page (`appinstalled`). */
export const installed = writable(false);

/** Whether this page runs as the installed app. */
export function standalone() {
	try {
		return globalThis.matchMedia?.('(display-mode: standalone)').matches || /** @type {any} */ (globalThis.navigator)?.standalone === true;
	} catch {
		return false;
	}
}

/** Whether the hint was dismissed on this device. */
export function hintDismissed() {
	try {
		return globalThis.localStorage?.getItem(DISMISSED_KEY) === '1';
	} catch {
		return false;
	}
}

/** Remembers a dismissed hint on this device, if it can. */
export function dismissHint() {
	try {
		globalThis.localStorage?.setItem(DISMISSED_KEY, '1');
	} catch {
		/* not remembered: it shows again next time */
	}
}

/**
 * Shows the browser's prompt, once; the event cannot be used again, so it is
 * dropped whatever the answer. Returns the person's choice, or null.
 * @returns {Promise<string | null>}
 */
export async function showPrompt() {
	/** @type {any} */
	let event = null;
	promptEvent.update((e) => ((event = e), null));
	if (!event) return null;
	await event.prompt();
	const choice = await event.userChoice?.catch(() => null);
	if (choice?.outcome === 'accepted') installed.set(true);
	return choice?.outcome ?? null;
}

if (typeof window !== 'undefined') {
	window.addEventListener('beforeinstallprompt', (event) => {
		// No mini-infobar of its own: the page offers the button where it fits.
		event.preventDefault();
		promptEvent.set(event);
	});
	window.addEventListener('appinstalled', () => {
		promptEvent.set(null);
		installed.set(true);
	});
}
