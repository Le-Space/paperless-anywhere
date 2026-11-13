// Le Space Credits for paperless-anywhere: one ledger service for Belege and
// paperless-anywhere (Le-Space/le-space-credits, contract on
// Le-Space/belege#591), sold separately – a balance belongs to one product
// and one address. The address is the vault's Aleph key, so the balance
// follows the passkey to every device and needs no wallet.
//
// A request is signed with that key (EIP-191, as the app signs Aleph
// messages) over one line: the scheme, method, path, product, address and the
// time in seconds. The service takes each timestamp once, within 5 minutes.
import { privateKeyToAccount } from 'viem/accounts';
import { alephPrivateKey, backupPrivateKey } from './keys/derive.js';
import { currentLang, format, tr } from './i18n/index.js';

export const CREDITS_PRODUCT = 'paperless-anywhere';
export const SCHEME = 'ls-credits/v1';
/** The service; empty until it runs, and then the balance stays hidden. */
export const CREDITS_URL = String(import.meta.env?.VITE_CREDITS_URL ?? '').replace(/\/+$/, '');

/** @param {{ method: string, path: string, product: string, address: string, timestamp: number }} r */
export const canonical = ({ method, path, product, address, timestamp }) =>
	`${SCHEME}\n${method.toUpperCase()}\n${path}\n${product}\n${address}\n${timestamp}`;

// The service takes each (address, second) once: two requests in the same
// second (read the balance, then fund) would get the second one refused as
// REPLAY. So each request of an address gets a later second than the one
// before; a few seconds ahead stay well inside the service's 5 minutes.
/** @type {Map<string, number>} */
const lastStamp = new Map();
/** @param {string} address */
export function nextStamp(address, now = Math.floor(Date.now() / 1000)) {
	const key = address.toLowerCase();
	const t = Math.max(now, (lastStamp.get(key) ?? 0) + 1);
	lastStamp.set(key, t);
	return t;
}

/**
 * The headers of a signed request.
 * @param {import('viem').LocalAccount} account
 * @param {{ method: string, path: string, product?: string, timestamp?: number }} r
 */
export async function signedHeaders(account, { method, path, product = CREDITS_PRODUCT, timestamp }) {
	timestamp ??= nextStamp(account.address);
	const signature = await account.signMessage({ message: canonical({ method, path, product, address: account.address, timestamp }) });
	return { 'X-LS-Address': account.address, 'X-LS-Timestamp': String(timestamp), 'X-LS-Signature': signature };
}

/** The account the ledger knows this vault by. @param {Uint8Array} master */
export const creditsAccount = (master) => privateKeyToAccount(alephPrivateKey(master));

/**
 * This vault's paperless-anywhere balance: credits (1 = 1 euro cent), what is
 * reserved for a running VM, and this month's lines. Null without a service.
 * @param {Uint8Array} master
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ credits: number, reserved: number, lines: Record<string, number> } | null>}
 */
export async function creditsBalance(master, { baseUrl = CREDITS_URL, fetch: fetchImpl = fetch } = {}) {
	if (!baseUrl) return null;
	const path = '/v1/balance';
	const headers = await signedHeaders(creditsAccount(master), { method: 'GET', path });
	const res = await fetchImpl(`${baseUrl}${path}?product=${CREDITS_PRODUCT}`, { headers, cache: 'no-store' });
	const body = await res.json().catch(() => null);
	if (!res.ok) throw new Error(body?.error ? `Le Space Credits: ${body.error}` : tr().credits.answers(res.status));
	const p = body?.package;
	return {
		credits: Number(body?.credits ?? 0),
		reserved: Number(body?.reserved ?? 0),
		lines: body?.lines_this_month ?? {},
		plan: p?.id
			? {
					id: String(p.id),
					periodStart: p.period_start ?? null,
					periodEnd: p.period_end ?? null,
					hoursLeft: p.hours_left == null ? null : Number(p.hours_left),
					// A Stripe subscription (card, monthly invoice) or a plan paid from the balance.
					// A Stripe subscription, a voucher's period (le-space-credits#73), or a plan paid from the balance.
					billing: p.billing === 'stripe' ? 'stripe' : p.billing === 'voucher' ? 'voucher' : 'credits',
					renewsAt: p.renews_at ?? null,
					cancelAtPeriodEnd: Boolean(p.cancel_at_period_end)
				}
			: null,
		terms: termsOf(body?.terms),
		backup: backupOf(body?.backup)
	};
}

/**
 * Which terms (AGB) this account accepted, which are in force, which are
 * announced (le-space-credits#36). `due` = in force and not accepted: buying
 * is refused (412 TERMS) until it is. Null fields while none are published.
 * @param {any} t
 */
export function termsOf(t) {
	const accepted = t?.accepted?.version ? { version: String(t.accepted.version), url: safeUrl(t.accepted.url), sha256: String(t.accepted.sha256 ?? ''), acceptedAt: t.accepted.accepted_at ?? null } : null;
	const current = t?.current ? String(t.current) : null;
	const pending = t?.pending?.version ? { version: String(t.pending.version), effectiveAt: t.pending.effectiveAt ?? null } : null;
	return { accepted, current, pending, due: Boolean(current && accepted?.version !== current), announced: Boolean(pending && accepted?.version !== pending.version) };
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const NETWORKS = ['calibration', 'mainnet'];

const NOTICE_KINDS = ['expires_soon', 'expired', 'retention_over'];
/**
 * The service's notice on a backup that runs out (le-space-credits#69): the
 * service picks the moment, the app the words. Null without one.
 * @param {any} n
 * @returns {{ kind: 'expires_soon' | 'expired' | 'retention_over', fundedUntil: string | null, retentionUntil: string | null, daysLeft: number | null, retentionDaysLeft: number | null } | null}
 */
export function backupNoticeOf(n) {
	if (!n || !NOTICE_KINDS.includes(n.kind)) return null;
	const days = (/** @type {unknown} */ d) => (Number.isFinite(Number(d)) && d != null ? Number(d) : null);
	return { kind: n.kind, fundedUntil: n.funded_until ? String(n.funded_until) : null, retentionUntil: n.retention_until ? String(n.retention_until) : null, daysLeft: days(n.days_left), retentionDaysLeft: days(n.retention_days_left) };
}

/**
 * Where this account's backups stand with the service (design 2.2): Le
 * Space's one Filecoin payer and the session key that signs for it, the
 * account's tag in its data sets' metadata, the network, paid until when,
 * and the client data set ids the service signed for this account (decimal
 * strings; anything else is dropped). Null while the service pays no
 * backups, or when it names no payer.
 * @param {any} b
 * @returns {{ payer: string, signer: string | null, tag: string, network: 'calibration' | 'mainnet', fundedUntil: string | null, active: boolean | null, renewsWithPlan: boolean, retentionUntil: string | null, notice: ReturnType<typeof backupNoticeOf>, dataSets: string[] } | null}
 */
export function backupOf(b) {
	if (!b || !ADDRESS.test(String(b.payer ?? ''))) return null;
	return {
		payer: String(b.payer),
		signer: ADDRESS.test(String(b.signer ?? '')) ? String(b.signer) : null,
		tag: String(b.tag ?? ''),
		network: b.network === 'mainnet' ? 'mainnet' : 'calibration',
		fundedUntil: b.funded_until ? String(b.funded_until) : null,
		// le-space-credits#69; null from a service that does not say.
		active: typeof b.active === 'boolean' ? b.active : null,
		renewsWithPlan: b.renews_with_plan === true,
		retentionUntil: b.retention_until ? String(b.retention_until) : null,
		notice: backupNoticeOf(b.notice),
		dataSets: Array.isArray(b.data_sets) ? b.data_sets.map((id) => String(id)).filter((id) => /^\d{1,78}$/.test(id)) : []
	};
}

/** An https link only, for the terms' text. @param {unknown} url */
const safeUrl = (url) => {
	try {
		const u = new URL(String(url ?? ''));
		return u.protocol === 'https:' ? u.href : null;
	} catch {
		return null;
	}
};

/**
 * The published terms: the version in force and an announced one, each with
 * its text's address, checksum and what changed. Public.
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 */
export async function creditsTerms({ baseUrl = CREDITS_URL, fetch: fetchImpl = fetch } = {}) {
	if (!baseUrl) return null;
	const res = await fetchImpl(`${baseUrl}/v1/terms?product=${CREDITS_PRODUCT}`, { cache: 'no-store' });
	if (!res.ok) throw new Error(tr().credits.answers(res.status));
	const body = await res.json();
	const one = (v) => (v?.version ? { version: String(v.version), date: v.date ?? null, url: safeUrl(v.url), sha256: String(v.sha256 ?? ''), changes: Array.isArray(v.changes) ? v.changes.map(String) : v.changes ? [String(v.changes)] : [], effectiveAt: v.effectiveAt ?? null } : null);
	return { current: one(body?.current), pending: one(body?.pending), withdrawal: withdrawalOf(body?.withdrawal) };
}

/**
 * The declaration on withdrawal the service asks for before a purchase
 * (§ 356 Abs. 4 and 5 BGB, le-space-credits#51): its version and its text in
 * German and English. Null from an older service that sends none: then the
 * app shows no checkbox and sends no waiver. The text is shown as text only.
 * @param {any} w
 * @returns {{ version: string, de: string, en: string } | null}
 */
export function withdrawalOf(w) {
	const version = typeof w?.version === 'string' || typeof w?.version === 'number' ? String(w.version) : '';
	const de = typeof w?.de === 'string' ? w.de.trim() : '';
	const en = typeof w?.en === 'string' ? w.en.trim() : '';
	if (!version || !(de || en)) return null;
	return { version, de: de || en, en: en || de };
}

/**
 * The declaration's text in the UI's language. The app (/app) is German only;
 * `en` is there for the day it is not.
 * @param {{ de: string, en: string }} w @param {'de' | 'en'} [lang]
 */
export const withdrawalText = (w, lang = 'de') => (lang === 'en' ? w.en : w.de);

/**
 * What a purchase request carries for the declaration: its version when the
 * box is ticked, nothing otherwise (and nothing without a declaration).
 * @param {{ version: string } | null | undefined} withdrawal @param {boolean} ticked
 * @returns {{ waiver?: string }}
 */
export const waiverOf = (withdrawal, ticked) => (withdrawal?.version && ticked ? { waiver: withdrawal.version } : {});

/**
 * Accept a version of the terms (the one in force or the announced one).
 * @param {Uint8Array} master @param {string} version
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 */
export async function acceptTerms(master, version, options) {
	const r = await send(master, 'POST', '/v1/terms/accept', { version }, options);
	return { version: String(r?.version ?? version), acceptedAt: r?.accepted_at ?? null };
}

/** Buying needs the terms in force accepted first (412 TERMS). */
export class TermsError extends Error {}

/** Buying needs the declaration on withdrawal (412 WAIVER): missing, or an old version. */
export class WaiverError extends Error {}

/** A 412 from the service: the declaration on withdrawal, or the terms. @param {any} answer */
const preconditionError = (answer) => (answer?.code === 'WAIVER' ? new WaiverError(tr().credits.waiver) : new TermsError(tr().credits.terms));

/**
 * This vault's purchases for paperless-anywhere, newest first, each with the
 * Stripe invoice once Stripe has made it. Only an https link on stripe.com is
 * kept: the app shows it as a link and opens nothing else.
 * @param {Uint8Array} master
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ id: string, at: string, cents: number, credits: number, invoiceUrl: string | null }[] | null>}
 */
export async function creditsPurchases(master, { baseUrl = CREDITS_URL, fetch: fetchImpl = fetch } = {}) {
	if (!baseUrl) return null;
	const path = '/v1/purchases';
	const headers = await signedHeaders(creditsAccount(master), { method: 'GET', path });
	const res = await fetchImpl(`${baseUrl}${path}?product=${CREDITS_PRODUCT}`, { headers, cache: 'no-store' });
	const body = await res.json().catch(() => null);
	if (!res.ok) throw new Error(body?.error ? `Le Space Credits: ${body.error}` : tr().credits.answers(res.status));
	return (body?.purchases ?? [])
		.map((p) => ({ id: String(p.id), at: String(p.created_at ?? ''), cents: Number(p.amount_cents ?? 0), credits: Number(p.credits ?? 0), invoiceUrl: stripeLink(p.stripe_invoice_url) }))
		.sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** An invoice link only if it is https on stripe.com. @param {unknown} url */
export function stripeLink(url) {
	try {
		const u = new URL(String(url ?? ''));
		return u.protocol === 'https:' && (u.hostname === 'stripe.com' || u.hostname.endsWith('.stripe.com')) ? u.href : null;
	} catch {
		return null;
	}
}

/**
 * The monthly packages for paperless-anywhere: a subscription paid by card,
 * with the backup in its price (le-space-credits#72, terms version 3). The
 * service lists them (GET /v1/packages, public); this is what the app shows
 * until it has asked.
 */
export const PLANS = Object.freeze([
	{ id: 'paperless-15-backup', hours: 15, priceCredits: 640, backupIncluded: true },
	{ id: 'paperless-100-backup', hours: 100, priceCredits: 1640, backupIncluded: true },
	{ id: 'paperless-always-backup', hours: 730, priceCredits: 9050, backupIncluded: true }
]);
/**
 * What a month of backups costs, in credits, until the service's own list has
 * answered (its `backup_month_credits`; the terms' § 7 name the same amount).
 */
export const BACKUP_MONTH_CREDITS = 150;
/** A year of keeping the backups, paid once, in cents (the terms' § 7), until the service's list has answered. */
export const BACKUP_YEAR_CENTS = 1800;
/** A month of backups as the list of packages names it, else the known price. @param {{ backupMonthCredits?: number }[]} plans */
export const backupMonthCredits = (plans) => plans.find((p) => Number.isFinite(p.backupMonthCredits) && /** @type {number} */ (p.backupMonthCredits) > 0)?.backupMonthCredits ?? BACKUP_MONTH_CREDITS;
/**
 * Packages no longer offered (le-space-credits#53): an account that has one
 * keeps it and renews on it until it switches, so the app still names it.
 */
export const RETIRED_PLANS = Object.freeze([
	{ id: 'paperless-10', hours: 10, priceCredits: 400 },
	{ id: 'paperless-30', hours: 30, priceCredits: 600 },
	{ id: 'paperless-80', hours: 80, priceCredits: 1000 },
	// Without the backup, which every package offered now includes
	// (le-space-credits#72); named here so an account still on one reads right
	// once the service no longer lists them.
	{ id: 'paperless-15', hours: 15, priceCredits: 490 },
	{ id: 'paperless-100', hours: 100, priceCredits: 1490 },
	{ id: 'paperless-always', hours: 730, priceCredits: 8900 }
]);
export const planOf = (id, plans = PLANS) => plans.find((p) => p.id === id) ?? RETIRED_PLANS.find((p) => p.id === id) ?? null;

/** A month of round-the-clock running: a package this large is "Dauerbetrieb". */
export const ALWAYS_HOURS = 720;
/** How a package's hours read: "15 Stunden", or "Dauerbetrieb" for round the clock. @param {{ hours: number }} plan */
export const planHours = (plan) => tr().credits.planHours(plan.hours, plan.hours >= ALWAYS_HOURS);

/**
 * Few hours left of a package: at most a fifth of it, and never less than two hours.
 * @param {number | null} hoursLeft @param {{ hours: number } | null} plan
 */
export const fewHoursLeft = (hoursLeft, plan) => Boolean(plan && hoursLeft != null && hoursLeft <= Math.max(2, Math.floor(plan.hours / 5)));

/**
 * The next larger package, or null for the largest.
 * @template {{ hours: number }} P
 * @param {P | null} plan @param {readonly P[]} [plans]
 * @returns {P | null}
 */
export const biggerPlan = (plan, plans = /** @type {any} */ (PLANS)) => (plan ? ([...plans].sort((a, b) => a.hours - b.hours).find((p) => p.hours > plan.hours) ?? null) : null);

/** What a package means in a week (about 4.33 weeks a month), as on the landing page. */
export const hoursPerWeek = (/** @type {number} */ hours) => Math.max(1, Math.round(hours / 4.33));

/**
 * What the service sells of backups beside the months from the balance
 * (le-space-credits#69): a line in the plan's subscription and a year at
 * once. `planOffered` is false until the terms that name them are in force;
 * null from a service that knows neither.
 * @param {any} b
 * `includedInPlans`: every package offered includes the backup in its price (le-space-credits#72).
 * @returns {{ monthCents: number, yearCents: number, yearDays: number, copies: number | null, quotaGib: number | null, retentionDays: number, planOffered: boolean, includedInPlans: boolean } | null}
 */
export function backupOfferOf(b) {
	const cents = (/** @type {unknown} */ v) => (Number.isInteger(v) && /** @type {number} */ (v) > 0 ? /** @type {number} */ (v) : null);
	const monthCents = cents(b?.month_price_cents);
	const yearCents = cents(b?.year_price_cents);
	if (monthCents == null || yearCents == null) return null;
	return { monthCents, yearCents, yearDays: cents(b.year_days) ?? 365, copies: cents(b.copies), quotaGib: cents(b.quota_gib), retentionDays: cents(b.retention_days) ?? 30, planOffered: b.plan_offered === true, includedInPlans: b.included_in_plans === true };
}

/**
 * The service's packages and top-ups for this product (public, unsigned).
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ plans: { id: string, hours: number, priceCredits: number }[], topups: { id: string, amountCents: number, credits: number }[] } | null>}
 */
export async function creditsCatalog({ baseUrl = CREDITS_URL, fetch: fetchImpl = fetch } = {}) {
	if (!baseUrl) return null;
	const res = await fetchImpl(`${baseUrl}/v1/packages?product=${CREDITS_PRODUCT}`, { cache: 'no-store' });
	if (!res.ok) throw new Error(tr().credits.answers(res.status));
	const body = await res.json();
	return {
		// Where the service pays backups: calibration, mainnet, or null while off.
		network: body?.network === 'mainnet' || body?.network === 'calibration' ? body.network : null,
		plans: (body?.packages ?? []).map((p) => ({ id: String(p.id), hours: Number(p.hours), priceCredits: Number(p.price_credits), ...(p.backup_month_credits != null ? { backupMonthCredits: Number(p.backup_month_credits) } : {}), ...(p.backup_included === true ? { backupIncluded: true } : {}) })),
		backup: backupOfferOf(body?.backup),
		// Vouchers can be redeemed: only when the service says so (its terms that name them are in force).
		voucherOffered: body?.voucher?.offered === true,
		topups: (body?.topups ?? []).map((t) => ({ id: String(t.id), amountCents: Number(t.amount_cents), credits: Number(t.credits) }))
	};
}

/** The balance does not cover it (402); `neededCredits` when the service says. */
export class CreditsShortError extends Error {
	/** @param {string} message @param {number | null} neededCredits */
	constructor(message, neededCredits) {
		super(message);
		this.name = 'CreditsShortError';
		this.neededCredits = neededCredits;
	}
}

/**
 * A table of messages by error code that reads the catalogue each time a code
 * is looked up, so a message is in the language shown at that moment. It can
 * be spread into another table like a plain object.
 * @param {(c: ReturnType<typeof tr>['credits']) => Record<string, string>} pick
 * @returns {Record<string, string>}
 */
const table = (pick) =>
	new Proxy(/** @type {Record<string, string>} */ ({}), {
		get: (_, code) => pick(tr().credits)[/** @type {string} */ (code)],
		has: (_, code) => code in pick(tr().credits),
		ownKeys: () => Reflect.ownKeys(pick(tr().credits)),
		getOwnPropertyDescriptor: (_, code) => (code in pick(tr().credits) ? { enumerable: true, configurable: true, value: pick(tr().credits)[/** @type {string} */ (code)] } : undefined)
	});

/** What the service's error codes mean for a person (le-space-credits, /v1/vm/fund). */
const MESSAGES = table((c) => c.codes);

/** The same codes where a backup key is meant (POST /v1/backup/authorize). */
// Buying VM hours: TOO_SOON means the last purchase is younger than 10
// minutes and its hours are on the way (not the backups' TOO_SOON).
const VM_FUND_MESSAGES = table((c) => c.vmFund);

const BACKUP_KEY_MESSAGES = table((c) => c.backupKey);

/**
 * A signed JSON request to the service; throws with its message, and a
 * CreditsShortError on 402.
 * @param {Uint8Array} master @param {string} method @param {string} path @param {any} body
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 */
async function send(master, method, path, body, { baseUrl = CREDITS_URL, fetch: fetchImpl = fetch } = {}, messages = MESSAGES) {
	if (!baseUrl) throw new Error(tr().credits.notSetUp);
	const headers = await signedHeaders(creditsAccount(master), { method, path });
	const res = await fetchImpl(`${baseUrl}${path}`, {
		method,
		headers: { ...headers, 'content-type': 'application/json' },
		body: JSON.stringify({ product: CREDITS_PRODUCT, address: creditsAccount(master).address, ...body })
	});
	const answer = await res.json().catch(() => null);
	if (res.status === 412) throw preconditionError(answer);
	if (res.status === 402) {
		// "insufficient credits: N free, M needed"
		const [, free, needed] = /(\d+)\s*free,\s*(\d+)\s*needed/.exec(String(answer?.error ?? '')) ?? [];
		const missing = free != null ? Math.max(0, Number(needed) - Number(free)) : null;
		throw new CreditsShortError(tr().credits.short(missing != null ? format.euro(missing) : null), missing);
	}
	if (!res.ok) {
		const e = /** @type {Error & { status?: number, code?: string }} */ (new Error(messages[answer?.code] ?? MESSAGES[answer?.code] ?? (answer?.error ? `Le Space Credits: ${answer.error}` : tr().credits.answers(res.status))));
		e.status = res.status;
		e.code = typeof answer?.code === 'string' ? answer.code : undefined;
		throw e;
	}
	return answer;
}

/**
 * Choose a monthly package, or end it with null (at the period's end;
 * nothing is refunded mid-period).
 * @param {Uint8Array} master @param {string | null} planId
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ package: string | null, periodStart: string | null, periodEnd: string | null }>}
 */
export async function choosePlan(master, planId, options) {
	const r = await send(master, 'PUT', '/v1/package', { package: planId }, options);
	return { package: r?.package ?? null, periodStart: r?.period_start ?? null, periodEnd: r?.period_end ?? null };
}

/**
 * Buy usable VM hours from the balance: the service grants the Aleph credits
 * (plus Aleph's start reserve when the address lacks it) to this vault's
 * address, expiring with the current period.
 * @param {Uint8Array} master @param {number} hours
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ transferId: string, alephCredits: number, chargedCredits: number, expiration: string | null }>}
 */
export async function fundVm(master, hours, options) {
	const r = await send(master, 'POST', '/v1/vm/fund', { hours }, options, VM_FUND_MESSAGES);
	// `to`: the account the service granted to (the app's address, or the
	// customer's Le Space sub-account under model A); null from an older service.
	const to = /^0x[0-9a-fA-F]{40}$/.test(String(r?.to ?? '')) ? String(r.to) : null;
	return { transferId: String(r?.transfer_id ?? ''), alephCredits: Number(r?.aleph_credits ?? 0), chargedCredits: Number(r?.charged_credits ?? 0), expiration: r?.expiration ?? null, to };
}

/**
 * The service answered a quote request like a purchase: it does not know
 * `quote` yet, and may have charged. `charged` is what its answer says it
 * charged (null when it says nothing).
 */
export class QuoteUnsupportedError extends Error {
	/** @param {any} answer */
	constructor(answer) {
		const charged = answer && typeof answer === 'object' && Number.isFinite(Number(answer.charged_credits)) && answer.charged_credits !== null ? Number(answer.charged_credits) : null;
		const bought = charged != null || Boolean(answer?.transfer_id);
		super(
			bought
				? tr().credits.quoteUnsupportedBought(charged)
				: tr().credits.quoteUnsupported
		);
		this.name = 'QuoteUnsupportedError';
		this.charged = charged;
		this.bought = bought;
	}
}

/** @param {unknown} v */
const numberOrNull = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * What buying `hours` would cost, without buying: the service answers with
 * `quote: true` and charges nothing. It includes Aleph's start reserve when
 * the receiving account lacks it. An older service ignores `quote` and buys;
 * any answer without `quote === true` is therefore no quote, and throws a
 * QuoteUnsupportedError – the caller must not buy after it.
 * @param {Uint8Array} master @param {number} hours
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ hours: number, alephCredits: number | null, chargedCredits: number, expiration: string | null, to: string | null, creditsBefore: number | null, creditsAfter: number | null, hoursBefore: number | null, hoursAfter: number | null }>}
 */
export async function quoteVm(master, hours, options) {
	const r = await send(master, 'POST', '/v1/vm/fund', { hours, quote: true }, options, VM_FUND_MESSAGES);
	if (r?.quote !== true) throw new QuoteUnsupportedError(r);
	const chargedCredits = numberOrNull(r.charged_credits);
	if (chargedCredits == null || chargedCredits < 0) throw new Error(tr().credits.noPrice);
	return {
		hours,
		alephCredits: numberOrNull(r.aleph_credits),
		chargedCredits,
		expiration: typeof r.expiration === 'string' && r.expiration ? r.expiration : null,
		to: /^0x[0-9a-fA-F]{40}$/.test(String(r.to ?? '')) ? String(r.to) : null,
		creditsBefore: numberOrNull(r.credits_before),
		creditsAfter: numberOrNull(r.credits_after),
		hoursBefore: numberOrNull(r.hours_before),
		hoursAfter: numberOrNull(r.hours_after)
	};
}

/**
 * Pay `months` of backups from Le Space Credits (design 2.2). Nothing moves on
 * chain: Le Space's one Filecoin payer pays the storage, and the service
 * signs the VM's backup steps until `fundedUntil`, within `quotaBytes`.
 * @param {Uint8Array} master @param {number} months
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ fundedUntil: string | null, chargedCredits: number, quotaBytes: number, payer: string, tag: string, network: string }>}
 */
export async function fundBackups(master, months, options) {
	// No package needed: the months are charged from free credits (le-space-credits#31).
	const r = await send(master, 'POST', '/v1/backup/fund', { months }, options);
	return {
		fundedUntil: r?.funded_until ? String(r.funded_until) : null,
		chargedCredits: Number(r?.chargedCredits ?? 0),
		quotaBytes: Number(r?.quota_bytes ?? 0),
		payer: String(r?.payer ?? ''),
		tag: String(r?.tag ?? ''),
		network: String(r?.network ?? '')
	};
}

/**
 * Record a VM's backup key with the account (at most 5): the service then
 * signs that key's backup steps for this account's own data sets. Answers
 * what the VM's config needs: Le Space's payer, the session key that signs
 * for it, the account's tag and the data sets' label.
 * @param {Uint8Array} master @param {string} backupKey the backup key's address
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ payer: string, signer: string, tag: string, label: string, network: 'calibration' | 'mainnet', fundedUntil: string | null }>}
 */
export async function backupAuthorize(master, backupKey, options) {
	if (!ADDRESS.test(String(backupKey ?? ''))) throw new Error(tr().credits.backupKeyNoAddress);
	const r = await send(master, 'POST', '/v1/backup/authorize', { backupKey }, options, BACKUP_KEY_MESSAGES);
	if (!ADDRESS.test(String(r?.payer ?? '')) || !ADDRESS.test(String(r?.signer ?? ''))) throw new Error(tr().credits.noBackupAccount);
	if (!/^[0-9a-f]{8,64}$/.test(String(r?.tag ?? ''))) throw new Error(tr().credits.noBackupTag);
	if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(r?.label ?? ''))) throw new Error(tr().credits.noBackupLabel);
	if (!NETWORKS.includes(r?.network)) throw new Error(tr().credits.noBackupNetwork);
	return {
		payer: String(r.payer),
		signer: String(r.signer),
		tag: String(r.tag),
		label: String(r.label),
		network: r.network,
		fundedUntil: r.funded_until ? String(r.funded_until) : null
	};
}

/**
 * What a customer can buy for paperless-anywhere, as le-space-credits'
 * src/lib/products.js lists it (proposals until Le-Space/belege#571). The
 * service checks the package; this list only draws the buttons.
 */
export const PACKAGES = Object.freeze([
	{ id: 'topup-20', name: '20 €', credits: 2000 },
	{ id: 'topup-50', name: '50 €', credits: 5000 }
]);

/**
 * Open a Stripe Checkout for a package: the service returns the session's
 * client secret, which only its /pay page uses.
 * `waiver`: the declaration's version, only when its box is ticked (waiverOf).
 * @param {Uint8Array} master
 * @param {string} packageId
 * @param {{ waiver?: string, baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<string>} the client secret
 */
export async function startCheckout(master, packageId, { waiver, baseUrl = CREDITS_URL, fetch: fetchImpl = fetch } = {}) {
	const path = '/v1/checkout';
	const headers = await signedHeaders(creditsAccount(master), { method: 'POST', path });
	const res = await fetchImpl(`${baseUrl}${path}`, {
		method: 'POST',
		headers: { ...headers, 'content-type': 'application/json' },
		body: JSON.stringify({ product: CREDITS_PRODUCT, package: packageId, locale: currentLang(), ...(waiver ? { waiver } : {}) })
	});
	const body = await res.json().catch(() => null);
	if (res.status === 412) throw preconditionError(body);
	if (res.status === 503) throw new Error(tr().credits.payOff);
	if (!res.ok || typeof body?.client_secret !== 'string') throw new Error(body?.error ? `Le Space Credits: ${body.error}` : tr().credits.answers(res.status));
	return body.client_secret;
}

/**
 * Model A: let this app start and forget VMs as the delegate of the Le Space
 * account that owns and pays them for this customer. The customer never holds
 * Aleph credits; the service accounts the hours (le-space-credits#38).
 * @param {Uint8Array} master
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ owner: string, delegate: string, hoursLeft: number | null, periodEnd: string | null, revokeAt: string | null }>}
 */
export async function vmAuthorize(master, options) {
	const r = await send(master, 'POST', '/v1/vm/authorize', {}, options);
	if (!/^0x[0-9a-fA-F]{40}$/.test(String(r?.owner ?? ''))) throw new Error(tr().credits.noVmAccount);
	return {
		owner: String(r.owner),
		delegate: String(r.delegate ?? ''),
		hoursLeft: r.hours_left == null ? null : Number(r.hours_left),
		periodEnd: r.period_end ?? null,
		revokeAt: r.revoke_at ?? null
	};
}

/**
 * Revoke a VM's backup key (DELETE /v1/backup/authorize): the service signs
 * nothing more for it. No terms needed. `revoked` is false when the service
 * did not know the key (already revoked).
 * @param {Uint8Array} master @param {string} backupKey the backup key's address
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ revoked: boolean }>}
 */
export async function backupRevoke(master, backupKey, options) {
	if (!ADDRESS.test(String(backupKey ?? ''))) throw new Error(tr().credits.backupKeyNoAddress);
	const r = await send(master, 'DELETE', '/v1/backup/authorize', { backupKey }, options, BACKUP_KEY_MESSAGES);
	return { revoked: r?.revoked === true };
}

/**
 * Subscribe to a package with Stripe (card, monthly invoice): the service
 * answers a Checkout in subscription mode, mounted like a top-up on /pay.
 * `waiver`: the declaration's version, only when its box is ticked (waiverOf).
 * `backup`: with the backup line (le-space-credits#69), only when its box is ticked.
 * @param {Uint8Array} master @param {string} packageId
 * @param {{ waiver?: string, backup?: boolean, baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<string>} the client secret
 */
export async function startSubscription(master, packageId, { waiver, backup = false, ...options } = {}) {
	const r = await send(master, 'POST', '/v1/subscribe', { package: packageId, locale: currentLang(), ...(waiver ? { waiver } : {}), ...(backup ? { backup: true } : {}) }, options);
	if (typeof r?.client_secret !== 'string') throw new Error(tr().credits.noCheckout);
	return r.client_secret;
}

const BACKUP_PLAN_MESSAGES = table((c) => c.backupPlan);

/**
 * Add the backup line to the running subscription: a purchase of its own,
 * with its own declaration on withdrawal. Stripe charges the rest of the
 * running month at once, and the line then renews with the plan.
 * @param {Uint8Array} master
 * @param {{ waiver?: string, baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ fundedUntil: string | null }>}
 */
export async function addBackupLine(master, { waiver, ...options } = {}) {
	const r = await send(master, 'POST', '/v1/backup/subscription', waiver ? { waiver } : {}, options, { ...MESSAGES, ...BACKUP_PLAN_MESSAGES });
	return { fundedUntil: r?.funded_until ? String(r.funded_until) : null };
}

/**
 * A year of keeping the backups, paid once (365 days from the later of today
 * and the paid end): its own embedded Checkout, with or without a plan.
 * @param {Uint8Array} master
 * @param {{ waiver?: string, baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<string>} the client secret
 */
export async function startBackupYear(master, { waiver, ...options } = {}) {
	const r = await send(master, 'POST', '/v1/backup/checkout', { locale: currentLang(), ...(waiver ? { waiver } : {}) }, options, { ...MESSAGES, ...BACKUP_PLAN_MESSAGES });
	if (typeof r?.client_secret !== 'string') throw new Error(tr().credits.noYearCheckout);
	return r.client_secret;
}

/**
 * Read the balance until the backup is paid further than `before` (the
 * webhook books it a moment after the payment), or give up.
 * @param {Uint8Array} master @param {string | null} before the paid end before the purchase
 * @param {{ tries?: number, delayMs?: number, read?: typeof creditsBalance }} [options]
 */
export async function waitForBackup(master, before, { tries = 30, delayMs = 2000, read = creditsBalance } = {}) {
	const was = before ? Date.parse(before) : 0;
	let last = null;
	for (let i = 0; i < tries; i++) {
		last = await read(master).catch(() => last);
		const until = last?.backup?.fundedUntil ? Date.parse(last.backup.fundedUntil) : 0;
		if (until > was) return { booked: true, balance: last };
		await new Promise((r) => setTimeout(r, delayMs));
	}
	return { booked: false, balance: last };
}

/**
 * Where the backup stands, in the app's words. The service says what is the
 * case (paid until, renews, notice); nothing here compares clocks.
 * `tone`: 'ok' a plain line, 'soon' a quiet hint, 'warn' a warning, 'over' the end.
 * @param {NonNullable<ReturnType<typeof backupOf>>} backup
 * @param {{ timeZone?: string }} [options]
 * @returns {{ tone: 'none' | 'ok' | 'soon' | 'warn' | 'over', text: string }}
 */
export function backupStatus(backup, { timeZone } = {}) {
	const date = (/** @type {string | null} */ iso) => (iso ? format.date(iso, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }) : '–');
	const b = tr().credits.backup;
	const n = backup.notice;
	if (n?.kind === 'retention_over') return { tone: 'over', text: b.over };
	if (n?.kind === 'expired') return { tone: 'warn', text: b.expired(date(n.fundedUntil ?? backup.fundedUntil), date(n.retentionUntil ?? backup.retentionUntil)) };
	if (n?.kind === 'expires_soon') {
		const week = n.daysLeft != null && n.daysLeft <= 7;
		return { tone: week ? 'warn' : 'soon', text: b.soon(date(n.fundedUntil ?? backup.fundedUntil), week ? n.daysLeft : null) };
	}
	if (backup.active && backup.renewsWithPlan) return { tone: 'ok', text: b.renews(date(backup.fundedUntil)) };
	if (backup.active) return { tone: 'ok', text: b.paid(date(backup.fundedUntil)) };
	return { tone: 'none', text: b.none };
}

/**
 * The Stripe customer portal for this account's subscription (change, cancel,
 * card, invoices); it returns to this app.
 * @param {Uint8Array} master
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 */
export async function subscriptionPortal(master, options) {
	const r = await send(master, 'POST', '/v1/portal', {}, options);
	const url = stripeLink(r?.url);
	if (!url) throw new Error(tr().credits.noPortal);
	return url;
}

/** An older service has no cancel route (404): cancel in Stripe's portal instead. */
export class CancelUnsupportedError extends Error {}

const CANCEL_MESSAGES = table((c) => c.cancel);

/**
 * Cancel the running subscription from the app's own cancel page (§ 312k
 * BGB): an ordinary cancellation at the end of the paid month. The service
 * records when it received it. Throws CancelUnsupportedError on 404 (an older
 * service), and says so when no subscription runs (409 NO_SUBSCRIPTION).
 * @param {Uint8Array} master
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ kind: 'ordinary', receivedAt: string, effectiveAt: string | null }>}
 */
export async function cancelSubscription(master, options) {
	let r;
	try {
		r = await send(master, 'POST', '/v1/subscription/cancel', {}, options, CANCEL_MESSAGES);
	} catch (e) {
		if (/** @type {any} */ (e)?.status === 404) throw new CancelUnsupportedError(tr().credits.cancelUnsupported);
		throw e;
	}
	const at = (/** @type {unknown} */ v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
	const receivedAt = at(r?.received_at);
	if (!receivedAt) throw new Error(tr().credits.cancelNotConfirmed);
	return { kind: 'ordinary', receivedAt, effectiveAt: at(r?.effective_at) };
}

// The legal wording of cancelling and withdrawing lives in legal-texts.js, German only.
export { CANCEL_KIND, CANCEL_MAIL, IMPRINT_URL, PROVIDER, WITHDRAWAL_SUBJECTS, cancelMailto, cancellationRecord, contractName, germanDate, germanDateTime, withdrawableName, withdrawalRecord } from './legal-texts.js';

/** An older service has no withdrawal route (404): the app then offers none. */
export class WithdrawalUnsupportedError extends Error {}

const WITHDRAWAL_MESSAGES = table((c) => c.withdrawal);
const VOUCHER_MESSAGES = table((c) => c.voucher);

/**
 * A voucher code as the service prints it: two letters and three groups of
 * four, "PA-XXXX-XXXX-XXXX". Typed in any case, with or without spaces and
 * hyphens. Null when it cannot be one, so nothing is sent for a typo.
 * @param {unknown} input
 * @returns {string | null}
 */
export function voucherCode(input) {
	const raw = String(input ?? '').toUpperCase().replace(/[\s-]+/g, '');
	if (!/^[A-Z]{2}[A-Z0-9]{12}$/.test(raw)) return null;
	return `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6, 10)}-${raw.slice(10, 14)}`;
}

/**
 * Redeem a voucher: a period of running time with backups, without a payment
 * (le-space-credits#73). The terms in force must be accepted, as for a
 * purchase (412 TERMS); no declaration on withdrawal, since nothing is paid.
 * `granted` false: the hours arrive with the service's next run.
 * @param {Uint8Array} master @param {string} code
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ days: number | null, hours: number | null, always: boolean, periodEnd: string | null, backupUntil: string | null, granted: boolean }>}
 */
export async function redeemVoucher(master, code, options) {
	const formatted = voucherCode(code);
	if (!formatted) throw new Error(tr().credits.voucher.VOUCHER_FORMAT);
	const r = await send(master, 'POST', '/v1/voucher/redeem', { code: formatted }, options, { ...MESSAGES, ...VOUCHER_MESSAGES });
	if (r?.redeemed !== true) throw new Error(tr().credits.voucherNotConfirmed);
	return { days: numberOrNull(r.days), hours: numberOrNull(r.hours), always: r.always === true, periodEnd: isoOrNull(r.period_end), backupUntil: isoOrNull(r.backup_until), granted: r.granted === true };
}

const isoOrNull = (/** @type {unknown} */ v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

/**
 * One contract the service lists as withdrawable (or withdrawn), as the app
 * shows it. `what` is the service's own naming of it and is shown as text.
 * @param {any} w
 * @returns {{ subject: 'subscription' | 'credits' | 'backup', what: string, concludedAt: string | null, until: string | null } | null}
 */
export function withdrawableOf(w) {
	if (w?.subject !== 'subscription' && w?.subject !== 'credits' && w?.subject !== 'backup') return null;
	return { subject: w.subject, what: typeof w.what === 'string' ? w.what.trim().slice(0, 200) : '', concludedAt: isoOrNull(w.concluded_at), until: isoOrNull(w.until) };
}

/**
 * What can be withdrawn right now (§ 356a BGB), without withdrawing: the
 * service answers with `quote: true`. An empty list means nothing can be
 * withdrawn any more, and the app shows no button. An older service ignores
 * `quote`; any answer without `quote === true` is therefore no quote, and the
 * caller must not go on: it throws a WithdrawalUnsupportedError, as a 404 does.
 * @param {Uint8Array} master
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<NonNullable<ReturnType<typeof withdrawableOf>>[]>}
 */
export async function withdrawalQuote(master, options) {
	let r;
	try {
		r = await send(master, 'POST', '/v1/withdrawal', { quote: true }, options, WITHDRAWAL_MESSAGES);
	} catch (e) {
		if (/** @type {any} */ (e)?.status === 404) throw new WithdrawalUnsupportedError(tr().credits.withdrawalUnsupported);
		throw e;
	}
	if (r?.quote !== true) throw new WithdrawalUnsupportedError(tr().credits.withdrawalUnsupported);
	return (Array.isArray(r.withdrawable) ? r.withdrawable : []).map(withdrawableOf).filter((w) => w !== null);
}

/**
 * Withdraw from everything that can still be withdrawn (§ 356a BGB). The
 * subscription ends at once and the unused balance goes into the refund
 * request; the service records when it received the declaration.
 * @param {Uint8Array} master
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ receivedAt: string, withdrawn: NonNullable<ReturnType<typeof withdrawableOf>>[], refund: { id: string, state: string } | null }>}
 */
export async function withdraw(master, options) {
	const r = await send(master, 'POST', '/v1/withdrawal', {}, options, WITHDRAWAL_MESSAGES);
	const receivedAt = isoOrNull(r?.received_at);
	if (!receivedAt) throw new Error(tr().credits.withdrawalNotConfirmed);
	const refund = r?.refund && typeof r.refund === 'object' ? { id: String(r.refund.refund_id ?? '').slice(0, 100), state: String(r.refund.state ?? '').slice(0, 40) } : null;
	return { receivedAt, withdrawn: (Array.isArray(r.withdrawn) ? r.withdrawn : []).map(withdrawableOf).filter((w) => w !== null), refund };
}

/**
 * Read the balance until the package is billed by Stripe (the webhook opens
 * it a moment after the payment), or give up and return the last one.
 * @param {Uint8Array} master
 * @param {{ tries?: number, delayMs?: number, read?: typeof creditsBalance }} [options]
 */
export async function waitForSubscription(master, { tries = 30, delayMs = 2000, read = creditsBalance } = {}) {
	let last = null;
	for (let i = 0; i < tries; i++) {
		last = await read(master).catch(() => last);
		if (last?.plan?.billing === 'stripe') return { booked: true, balance: last };
		await new Promise((r) => setTimeout(r, delayMs));
	}
	return { booked: false, balance: last };
}

/**
 * The service's /pay page for a checkout: Stripe.js runs there, on the
 * service's origin, never in this app's, which holds the unlocked vault.
 * The secret goes in the fragment and reaches no server.
 * @param {string} baseUrl @param {{ clientSecret: string, origin: string }} p
 */
export const payUrl = (baseUrl, { clientSecret, origin }) => `${baseUrl}/pay#${new URLSearchParams({ cs: clientSecret, origin })}`;

/**
 * What a message from the /pay page says: 'ready', 'paid' or 'failed', or
 * null for anything not from the service. A hint only; the signed balance is
 * the truth.
 * @param {MessageEvent} event @param {string} baseUrl
 */
export function payMessage(event, baseUrl) {
	if (!baseUrl || event.origin !== new URL(baseUrl).origin) return null;
	const type = event.data?.type;
	return type === 'ls-credits:ready' ? 'ready' : type === 'ls-credits:paid' ? 'paid' : type === 'ls-credits:failed' ? 'failed' : null;
}

/**
 * Read the balance until it is above `before` (the webhook books the purchase
 * a moment after Stripe reports it), or give up and return the last one.
 * @param {Uint8Array} master @param {number} before
 * @param {{ tries?: number, delayMs?: number, read?: typeof creditsBalance }} [options]
 */
export async function waitForTopUp(master, before, { tries = 20, delayMs = 1500, read = creditsBalance } = {}) {
	let last = null;
	for (let i = 0; i < tries; i++) {
		last = await read(master).catch(() => last);
		if (last && last.credits > before) return { booked: true, balance: last };
		await new Promise((r) => setTimeout(r, delayMs));
	}
	return { booked: false, balance: last };
}

/** The address of a VM's backup key (slot 0: the vault's VM). @param {Uint8Array} master @param {number} [slot] */
export const backupKeyAddress = (master, slot = 0) => privateKeyToAccount(backupPrivateKey(master, slot)).address;
