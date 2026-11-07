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
import { alephPrivateKey } from './keys/derive.js';

export const CREDITS_PRODUCT = 'paperless-anywhere';
export const SCHEME = 'ls-credits/v1';
/** The service; empty until it runs, and then the balance stays hidden. */
export const CREDITS_URL = String(import.meta.env?.VITE_CREDITS_URL ?? '').replace(/\/+$/, '');

/** @param {{ method: string, path: string, product: string, address: string, timestamp: number }} r */
export const canonical = ({ method, path, product, address, timestamp }) =>
	`${SCHEME}\n${method.toUpperCase()}\n${path}\n${product}\n${address}\n${timestamp}`;

/**
 * The headers of a signed request.
 * @param {import('viem').LocalAccount} account
 * @param {{ method: string, path: string, product?: string, timestamp?: number }} r
 */
export async function signedHeaders(account, { method, path, product = CREDITS_PRODUCT, timestamp = Math.floor(Date.now() / 1000) }) {
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
	if (!res.ok) throw new Error(body?.error ? `Le Space Credits: ${body.error}` : `Le Space Credits antwortet ${res.status}`);
	const p = body?.package;
	return {
		credits: Number(body?.credits ?? 0),
		reserved: Number(body?.reserved ?? 0),
		lines: body?.lines_this_month ?? {},
		plan: p?.id ? { id: String(p.id), periodStart: p.period_start ?? null, periodEnd: p.period_end ?? null, hoursLeft: p.hours_left == null ? null : Number(p.hours_left) } : null
	};
}

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
	if (!res.ok) throw new Error(body?.error ? `Le Space Credits: ${body.error}` : `Le Space Credits antwortet ${res.status}`);
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
 * The monthly packages for paperless-anywhere (Le-Space/belege#591 draft 2,
 * prices decided 2026-11-04): a package debits its price from the balance at
 * the start of each period and grants that period's Aleph credits to this
 * vault's address. The service lists them (GET /v1/packages, public); this is
 * what the app shows until it has asked.
 */
export const PLANS = Object.freeze([
	{ id: 'paperless-10', hours: 10, priceCredits: 400 },
	{ id: 'paperless-30', hours: 30, priceCredits: 600 },
	{ id: 'paperless-80', hours: 80, priceCredits: 1000 }
]);
export const planOf = (id, plans = PLANS) => plans.find((p) => p.id === id) ?? null;

/**
 * The service's packages and top-ups for this product (public, unsigned).
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ plans: { id: string, hours: number, priceCredits: number }[], topups: { id: string, amountCents: number, credits: number }[] } | null>}
 */
export async function creditsCatalog({ baseUrl = CREDITS_URL, fetch: fetchImpl = fetch } = {}) {
	if (!baseUrl) return null;
	const res = await fetchImpl(`${baseUrl}/v1/packages?product=${CREDITS_PRODUCT}`, { cache: 'no-store' });
	if (!res.ok) throw new Error(`Le Space Credits antwortet ${res.status}`);
	const body = await res.json();
	return {
		plans: (body?.packages ?? []).map((p) => ({ id: String(p.id), hours: Number(p.hours), priceCredits: Number(p.price_credits), ...(p.backup_month_credits != null ? { backupMonthCredits: Number(p.backup_month_credits) } : {}) })),
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

/** What the service's error codes mean for a person (le-space-credits, /v1/vm/fund). */
const MESSAGES = {
	NO_PLAN: 'Stunden nachkaufen geht mit einem Paket: erst ein Paket wählen.',
	TREASURY_OFF: 'Le Space Credits können gerade keine Aleph-Credits ausgeben. Später noch einmal versuchen.',
	REFUSED: 'Aleph hat die Gutschrift abgelehnt. Später noch einmal versuchen.',
	CAP: 'Le Space hat gerade nicht genug Aleph-Credits vorrätig. Später noch einmal versuchen.',
	HOURS: 'Diese Stundenzahl nimmt der Dienst nicht an.',
	ADDRESS: 'Le Space Credits nehmen die Adresse des Sicherungskontos nicht an.',
	TOO_SOON: 'Die Sicherungen wurden gerade erst bezahlt. Bitte in fünf Minuten noch einmal.',
	MONTHS: 'Sicherungen lassen sich für 1 bis 12 Monate bezahlen.',
	PAUSED: 'Le Space Credits zahlen gerade keine Sicherungen ein (Tageslimit oder noch nicht freigeschaltet). Später noch einmal versuchen.'
};

/**
 * A signed JSON request to the service; throws with its message, and a
 * CreditsShortError on 402.
 * @param {Uint8Array} master @param {string} method @param {string} path @param {any} body
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 */
async function send(master, method, path, body, { baseUrl = CREDITS_URL, fetch: fetchImpl = fetch } = {}) {
	if (!baseUrl) throw new Error('Le Space Credits sind hier nicht eingerichtet.');
	const headers = await signedHeaders(creditsAccount(master), { method, path });
	const res = await fetchImpl(`${baseUrl}${path}`, {
		method,
		headers: { ...headers, 'content-type': 'application/json' },
		body: JSON.stringify({ product: CREDITS_PRODUCT, address: creditsAccount(master).address, ...body })
	});
	const answer = await res.json().catch(() => null);
	if (res.status === 402) {
		// "insufficient credits: N free, M needed"
		const [, free, needed] = /(\d+)\s*free,\s*(\d+)\s*needed/.exec(String(answer?.error ?? '')) ?? [];
		const missing = free != null ? Math.max(0, Number(needed) - Number(free)) : null;
		throw new CreditsShortError(`Die Le Space Credits reichen dafür nicht${missing != null ? ` (es fehlen ${(missing / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })})` : ''}. Erst aufladen.`, missing);
	}
	if (!res.ok) throw new Error(MESSAGES[answer?.code] ?? (answer?.error ? `Le Space Credits: ${answer.error}` : `Le Space Credits antwortet ${res.status}`));
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
	const r = await send(master, 'POST', '/v1/vm/fund', { hours }, options);
	return { transferId: String(r?.transfer_id ?? ''), alephCredits: Number(r?.aleph_credits ?? 0), chargedCredits: Number(r?.charged_credits ?? 0), expiration: r?.expiration ?? null };
}

/**
 * Pay `months` of backups from Le Space Credits: the service deposits USDFC
 * into the Filecoin Pay account of `payer` (the vault's Filecoin payer) and,
 * the first time, sends it a little FIL for its approval transaction.
 * @param {Uint8Array} master @param {string} payer @param {number} months
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 */
export async function fundBackups(master, payer, months, options) {
	const r = await send(master, 'POST', '/v1/backup/fund', { payer, months }, options).catch((e) => {
		// The service's NO_PLAN speaks of hours; for backups it means the same: a package first.
		if (/erst ein Paket wählen/.test(e?.message ?? '')) throw new Error('Sicherungen über Le Space Credits gehen mit einem Paket: erst ein Paket wählen.');
		throw e;
	});
	return {
		txHash: String(r?.txHash ?? ''),
		confirmed: r?.confirmed !== false,
		deposited: String(r?.deposited ?? '0'),
		filSent: String(r?.filSent ?? '0'),
		chargedCredits: Number(r?.chargedCredits ?? 0),
		network: String(r?.network ?? '')
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
 * @param {Uint8Array} master
 * @param {string} packageId
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<string>} the client secret
 */
export async function startCheckout(master, packageId, { baseUrl = CREDITS_URL, fetch: fetchImpl = fetch } = {}) {
	const path = '/v1/checkout';
	const headers = await signedHeaders(creditsAccount(master), { method: 'POST', path });
	const res = await fetchImpl(`${baseUrl}${path}`, {
		method: 'POST',
		headers: { ...headers, 'content-type': 'application/json' },
		body: JSON.stringify({ product: CREDITS_PRODUCT, package: packageId, locale: 'de' })
	});
	const body = await res.json().catch(() => null);
	if (res.status === 503) throw new Error('Bezahlen ist beim Credits-Dienst noch nicht eingerichtet.');
	if (!res.ok || typeof body?.client_secret !== 'string') throw new Error(body?.error ? `Le Space Credits: ${body.error}` : `Le Space Credits antwortet ${res.status}`);
	return body.client_secret;
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
