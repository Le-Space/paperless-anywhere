// "Diagnose kopieren": what support needs to understand a problem, as text a
// person pastes into a mail. Strictly without secrets: the values are picked
// one by one from what the app knows (never the profile as a whole), wallet
// addresses are shortened, and every free text (an error message, a step)
// passes `scrub`, which removes what could be a key, a token, a phrase, a
// mail address, a URL's query or a file name.
//
// The last error and the state of Paperless are kept here in memory only,
// for this tab; nothing is written anywhere.

/** @typedef {{ action?: string, step?: string, message: string, at: number }} LastError */
/** @typedef {{ phase?: string, instanceHash?: string | null, node?: string | null, host?: string | null, relay?: string | null, image?: 'own' | 'public' | null, network?: string | null, pays?: string | null, payer?: string | null }} State */

/** @type {{ state: State, error: LastError | null }} */
const kept = { state: {}, error: null };

/** What the Paperless card shows now (Lifecycle.svelte). @param {State} state */
export function noteState(state) {
	kept.state = { ...state };
}

/** The last error the app showed, with the action and step it came from. @param {Omit<LastError, 'at'> & { at?: number }} e */
export function noteError(e) {
	if (!e?.message) return;
	kept.error = { action: e.action, step: e.step, message: String(e.message), at: e.at ?? Date.now() };
}

/** For tests: forget what was noted. */
export function resetDiagnosis() {
	kept.state = {};
	kept.error = null;
}

const HEX64 = /^[0-9a-f]{64}$/i;
const HOST = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/i;

/** A wallet address as 0x1234…abcd. @param {string | null | undefined} a */
export const shortAddress = (a) => (a && /^0x[0-9a-f]{40}$/i.test(a) ? `${a.slice(0, 6)}…${a.slice(-4)}` : null);

/**
 * Free text without anything that could be secret or personal. Order matters:
 * keys and tokens first, then what is merely long.
 * @param {unknown} text
 */
export function scrub(text) {
	return String(text ?? '')
		.replace(/AGE-SECRET-KEY-1[0-9A-Z]+/gi, '[key]')
		.replace(/\bbearer\s+\S+/gi, 'Bearer [hidden]')
		.replace(/\b(token|authorization|passphrase|password|secret|key)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi, '$1: [hidden]')
		.replace(/\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, '[mail]')
		.replace(/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/gi, '$1')
		.replace(/\b0x[0-9a-f]{40}\b/gi, (a) => shortAddress(a) ?? '[address]')
		.replace(/\b0x[0-9a-f]{41,}\b/gi, '[hex]')
		// 12 or more lowercase words in a row look like a recovery phrase.
		.replace(/\b(?:[a-z]{3,8}\s+){11,}[a-z]{3,8}\b/g, '[words]')
		// A long run of base64 or hex that is not a 64-digit hash: a key or a token.
		.replace(/[A-Za-z0-9+/_-]{40,}={0,2}/g, (m) => (HEX64.test(m) || /^ba[fg][a-z2-7]{50,}$/.test(m) ? m : '[hidden]'))
		.replace(/[^\s/\\"'\u201e\u201c]+\.(pdf|jpe?g|png|tiff?|gif|webp|heic|docx?|xlsx?|odt|ods|txt|eml|zip|age)\b/gi, '[file]')
		.slice(0, 600);
}

/** The browser, short: its name and version from the user agent, and the platform. @param {string} ua */
export function browserOf(ua) {
	const s = String(ua ?? '');
	const m = /(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/.exec(s);
	const name = !m ? 'unknown' : m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1] === 'Version' ? (/Safari/.test(s) ? 'Safari' : 'unknown') : m[1];
	const os = /iPhone|iPad/.test(s) ? 'iOS' : /Android/.test(s) ? 'Android' : /Mac OS X/.test(s) ? 'macOS' : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : 'unknown';
	return `${name}${m && name !== 'unknown' ? ` ${m[2]}` : ''} · ${os}`;
}

/**
 * The diagnosis as lines of text. Only values that look like what they claim
 * are taken; everything free passes `scrub`.
 * @param {{ build: { version?: string, commit?: string, time?: string }, cid?: string, unlocked?: boolean, state?: State, error?: LastError | null, userAgent?: string, now?: number, lang?: string }} a
 */
export function diagnosisText({ build, cid = '', unlocked = false, state = kept.state, error = kept.error, userAgent = globalThis.navigator?.userAgent ?? '', now = Date.now(), lang = '' }) {
	const lines = ['Paperless anywhere – diagnosis'];
	const add = (/** @type {string} */ k, /** @type {unknown} */ v) => {
		if (v !== undefined && v !== null && v !== '') lines.push(`${k}: ${v}`);
	};
	add('app', [build?.version, build?.commit && /^[0-9a-f]{7,40}$/.test(build.commit) ? build.commit : null].filter(Boolean).join(' · '));
	add('ipfs', /^ba[fg][a-z2-7]{20,}$/.test(cid) ? cid : null);
	add('page', globalThis.location ? `${location.origin}${location.pathname}` : null);
	add('time', new Date(now).toISOString());
	add('language', lang);
	add('browser', browserOf(userAgent));
	add('vault', unlocked ? 'unlocked' : 'locked');
	if (unlocked) {
		add('phase', state.phase && /^[a-z-]{2,32}$/.test(state.phase) ? state.phase : null);
		add('image', state.image === 'own' || state.image === 'public' ? state.image : null);
		add('network', state.network && /^[a-z]{3,16}$/.test(state.network) ? state.network : null);
		add('pays', state.pays && /^[a-z]{2,16}$/.test(state.pays) ? state.pays : null);
		add('payer', shortAddress(state.payer));
		add('vm', state.instanceHash && HEX64.test(state.instanceHash) ? state.instanceHash : null);
		add('node', state.node && HEX64.test(state.node) ? state.node : null);
		add('host', state.host && HOST.test(state.host) ? state.host : null);
		add('relay', state.relay && HOST.test(state.relay) ? state.relay : null);
	}
	if (error) {
		add('error at', new Date(error.at).toISOString());
		add('error action', error.action && /^[a-z-]{2,32}$/i.test(error.action) ? error.action : null);
		add('error step', error.step ? scrub(error.step) : null);
		add('error', scrub(error.message));
	} else add('error', 'none noted in this tab');
	return lines.join('\n');
}
