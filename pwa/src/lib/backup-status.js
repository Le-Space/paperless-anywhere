// The two lights at the top of the app: can the newest backup be fetched
// ("Sicherungen erreichbar"), and are its copies at different operators
// ("Kopien unabhängig")? Both are the app's own checks, made from this
// browser: the registry is read from the chain (free, no key), and each copy
// is asked with the restore check (restore-reach.js). Nothing is green that
// the app did not check itself; what it could not check stays grey.
//
// With the vault locked the app knows no backup (the list needs the vault's
// keys). So the provider ids of the newest backup's copies are kept unsealed
// in this browser, as the list was read last: public numbers, no piece CID,
// no data set id. That is what makes the lights answer before the unlock,
// which is when someone wonders whether a start will find their backup.
import { createPublicClient, http } from 'viem';
import { getPDPProvidersByIds } from '@filoz/synapse-core/sp-registry';
import { filecoinChain } from './permissions.js';
import { place } from './backups.js';
import { copyAnswers } from './restore-reach.js';
import { dependentPairs, operatorCount, registeredDomain } from './operators.js';

const KEY = 'paperless-anywhere.backup-copies';

/** @typedef {{ network: string, providerIds: number[], at: string }} KnownCopies */

/** The copies kept from the last list, or null. @returns {KnownCopies | null} */
export function knownCopies() {
	try {
		const v = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null');
		if (!v || typeof v.network !== 'string' || !Array.isArray(v.providerIds)) return null;
		return { network: v.network, providerIds: v.providerIds.map(Number).filter((n) => Number.isInteger(n) && n >= 0), at: String(v.at ?? '') };
	} catch {
		return null;
	}
}

/** Keeps the provider ids of the newest backup's copies (and nothing else). @param {string} network @param {number[]} providerIds */
export function rememberCopies(network, providerIds) {
	const v = { network, providerIds: [...new Set(providerIds.map(Number))], at: new Date().toISOString() };
	try {
		globalThis.localStorage?.setItem(KEY, JSON.stringify(v));
	} catch {
		// Storage blocked: the lights know the copies only while unlocked.
	}
	return v;
}

/** Forgets them, with the vault. */
export function forgetCopies() {
	try {
		globalThis.localStorage?.removeItem(KEY);
	} catch {
		// Nothing kept.
	}
}

/** @typedef {'ok' | 'warn' | 'bad' | 'unknown'} Level */

/** Green from two answering copies, yellow for one, red for none; grey without a check. @param {{ answering: number, total: number } | null} r @returns {Level} */
export const reachLevel = (r) => (!r || !r.total ? 'unknown' : r.answering >= 2 ? 'ok' : r.answering === 1 ? 'warn' : 'bad');

/**
 * Green when every copy is at another operator, yellow when two share one
 * (or there is only one copy); grey without the registry's answer, also for
 * a provider it does not name (nothing to compare).
 * @param {import('./operators.js').RegistryEntry[] | null} providers
 * @returns {Level}
 */
export const independenceLevel = (providers) =>
	!providers?.length ? 'unknown' : operatorCount(providers) < providers.length || providers.length < 2 ? 'warn' : providers.some((p) => /** @type {any} */ (p).listed === false) ? 'unknown' : 'ok';

/**
 * @typedef {{ id: number, name: string, place: string, domain: string | null, url: string, owner: string | null, payee: string | null, listed: boolean, answers: boolean }} CheckedCopy listed: whether the registry named the provider
 * @typedef {{ at: Date, network: string, copies: CheckedCopy[], answering: number, total: number, pairs: { a: CheckedCopy, b: CheckedCopy, signs: ReturnType<typeof import('./operators.js').sharedSigns> }[] }} CopyCheck
 */

/**
 * Reads the copies' providers from the registry and asks each copy, in
 * parallel. A copy is asked at its own piece URL where the app knows it
 * (unlocked), else at its provider's service (/pdp/ping): the answer says
 * the same, whether the provider's host is up.
 * @param {{ network: string, copies: { providerId: number, url?: string }[] }} what
 * @param {{ client?: any, answers?: typeof copyAnswers, now?: () => Date }} [deps]
 * @returns {Promise<CopyCheck>}
 */
export async function checkCopies({ network, copies }, { client, answers = copyAnswers, now = () => new Date() } = {}) {
	const ids = [...new Set(copies.map((c) => Number(c.providerId)))];
	if (!ids.length) return { at: now(), network, copies: [], answering: 0, total: 0, pairs: [] };
	const c = client ?? createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 15_000 }) });
	const listed = await getPDPProvidersByIds(c, { providerIds: ids.map(BigInt) });
	const byId = new Map(listed.map((p) => [Number(p.id), p]));
	// The registry answers per provider (a multicall that lets each call fail):
	// none answered is an unread registry, not a check.
	if (!byId.size) throw new Error('registry unread');
	const checked = await Promise.all(
		ids.map(async (id) => {
			const p = byId.get(id);
			const url = String(p?.pdp?.serviceURL ?? '').replace(/\/+$/, '');
			const own = copies.find((x) => Number(x.providerId) === id && x.url)?.url;
			const ask = own ?? (url ? `${url}/pdp/ping` : '');
			return {
				id,
				name: p?.name ?? '',
				place: place(p?.pdp?.location),
				domain: registeredDomain(url),
				url,
				owner: p?.serviceProvider ?? null,
				payee: p?.payee ?? null,
				listed: Boolean(p),
				answers: ask ? await answers(ask, { timeoutMs: 8000 }) : false
			};
		})
	);
	return { at: now(), network, copies: checked, answering: checked.filter((x) => x.answers).length, total: checked.length, pairs: dependentPairs(checked) };
}

/**
 * Whether any of these providers answers right now (before "Sichern und
 * beenden": where the backup will go). Null when the registry could not be
 * read: then nothing is said.
 * @param {string} network @param {number[]} ids
 * @param {Parameters<typeof checkCopies>[1]} [deps]
 * @returns {Promise<{ answering: number, total: number, names: string[] } | null>}
 */
export async function providersAnswer(network, ids, deps) {
	if (!ids.length) return null;
	try {
		const r = await checkCopies({ network, copies: ids.map((providerId) => ({ providerId })) }, deps);
		return { answering: r.answering, total: r.total, names: r.copies.map((c) => `${c.id} ${c.name}`.trim()) };
	} catch {
		return null;
	}
}

/** How long the lights wait between two checks by themselves, and at least between any two. */
export const RECHECK_MS = 5 * 60_000;
export const MIN_GAP_MS = 30_000;

/** Whether a check is due: none yet, or the last one older than `every`; never within `gap`. @param {Date | null} last @param {number} nowMs @param {{ every?: number, gap?: number, forced?: boolean }} [o] */
export function checkDue(last, nowMs, { every = RECHECK_MS, gap = MIN_GAP_MS, forced = false } = {}) {
	if (!last) return true;
	const age = nowMs - last.getTime();
	return age >= (forced ? gap : every);
}
