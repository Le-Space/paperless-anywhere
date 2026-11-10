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
	if (!res.ok) throw new Error(body?.error ? `Le Space Credits: ${body.error}` : `Le Space Credits antwortet ${res.status}`);
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
					billing: p.billing === 'stripe' ? 'stripe' : 'credits',
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

/**
 * Where this account's backups stand with the service (design 2.2): Le
 * Space's one Filecoin payer and the session key that signs for it, the
 * account's tag in its data sets' metadata, the network, paid until when,
 * and the client data set ids the service signed for this account (decimal
 * strings; anything else is dropped). Null while the service pays no
 * backups, or when it names no payer.
 * @param {any} b
 * @returns {{ payer: string, signer: string | null, tag: string, network: 'calibration' | 'mainnet', fundedUntil: string | null, dataSets: string[] } | null}
 */
export function backupOf(b) {
	if (!b || !ADDRESS.test(String(b.payer ?? ''))) return null;
	return {
		payer: String(b.payer),
		signer: ADDRESS.test(String(b.signer ?? '')) ? String(b.signer) : null,
		tag: String(b.tag ?? ''),
		network: b.network === 'mainnet' ? 'mainnet' : 'calibration',
		fundedUntil: b.funded_until ? String(b.funded_until) : null,
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
	if (!res.ok) throw new Error(`Le Space Credits antwortet ${res.status}`);
	const body = await res.json();
	const one = (v) => (v?.version ? { version: String(v.version), date: v.date ?? null, url: safeUrl(v.url), sha256: String(v.sha256 ?? ''), changes: Array.isArray(v.changes) ? v.changes.map(String) : v.changes ? [String(v.changes)] : [], effectiveAt: v.effectiveAt ?? null } : null);
	return { current: one(body?.current), pending: one(body?.pending) };
}

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
		// Where the service pays backups: calibration, mainnet, or null while off.
		network: body?.network === 'mainnet' || body?.network === 'calibration' ? body.network : null,
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
	NO_PLAN: 'Dafür braucht es ein laufendes Paket: erst ein Paket wählen.',
	TREASURY_OFF: 'Le Space Credits können gerade keine Aleph-Credits ausgeben. Später noch einmal versuchen.',
	REFUSED: 'Aleph hat die Gutschrift abgelehnt. Später noch einmal versuchen.',
	CAP: 'Le Space hat gerade nicht genug Aleph-Credits vorrätig. Später noch einmal versuchen.',
	HOURS: 'Diese Stundenzahl nimmt der Dienst nicht an.',
	VERSION: 'Diese Fassung der Bedingungen kann gerade nicht angenommen werden. Bitte die Seite neu laden.',
	ADDRESS: 'Le Space Credits nehmen den Schlüssel der VM für die Sicherungen nicht an.',
	TOO_SOON: 'Die Sicherungen wurden gerade erst bezahlt. Bitte in fünf Minuten noch einmal.',
	MONTHS: 'Sicherungen lassen sich für 1 bis 12 Monate bezahlen.',
	SUBS_OFF: 'Le Space Credits bezahlen VMs gerade noch nicht selbst. Später noch einmal versuchen.',
	DELEGATES: 'Zu viele Geräte sind schon für dieses Konto freigegeben.',
	SUBSCRIBED: 'Es läuft schon ein Abo. Ändern oder kündigen geht über „Abo verwalten“.',
	NO_SUBSCRIPTION: 'Es gibt noch kein Abo zum Verwalten.',
	ORIGIN: 'Diese Adresse der App darf das Abo-Portal nicht öffnen.',
	PRICE_TAX: 'Das Abo ist beim Credits-Dienst noch nicht fertig eingerichtet (Preise).',
	STRIPE_OFF: 'Bezahlen ist beim Credits-Dienst gerade abgeschaltet.',
	NO_BACKUP: 'Für dieses Produkt bezahlen Le Space Credits keine Sicherungen.',
	PAUSED: 'Le Space Credits zahlen gerade keine Sicherungen ein (Tageslimit oder noch nicht freigeschaltet). Später noch einmal versuchen.',
	BACKUP_OFF: 'Le Space Credits bezahlen gerade keine Sicherungen (beim Dienst nicht eingerichtet). Später noch einmal versuchen.',
	PRODUCT: 'Le Space Credits kennen dieses Produkt nicht.'
};

/** The same codes where a backup key is meant (POST /v1/backup/authorize). */
const BACKUP_KEY_MESSAGES = {
	DELEGATES: 'Für dieses Konto sind schon 5 VM-Schlüssel für Sicherungen freigegeben, mehr nimmt der Dienst nicht an.'
};

/**
 * A signed JSON request to the service; throws with its message, and a
 * CreditsShortError on 402.
 * @param {Uint8Array} master @param {string} method @param {string} path @param {any} body
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 */
async function send(master, method, path, body, { baseUrl = CREDITS_URL, fetch: fetchImpl = fetch } = {}, messages = MESSAGES) {
	if (!baseUrl) throw new Error('Le Space Credits sind hier nicht eingerichtet.');
	const headers = await signedHeaders(creditsAccount(master), { method, path });
	const res = await fetchImpl(`${baseUrl}${path}`, {
		method,
		headers: { ...headers, 'content-type': 'application/json' },
		body: JSON.stringify({ product: CREDITS_PRODUCT, address: creditsAccount(master).address, ...body })
	});
	const answer = await res.json().catch(() => null);
	if (res.status === 412) throw new TermsError('Erst den aktuellen Bedingungen (AGB) zustimmen, dann geht es weiter.');
	if (res.status === 402) {
		// "insufficient credits: N free, M needed"
		const [, free, needed] = /(\d+)\s*free,\s*(\d+)\s*needed/.exec(String(answer?.error ?? '')) ?? [];
		const missing = free != null ? Math.max(0, Number(needed) - Number(free)) : null;
		throw new CreditsShortError(`Die Le Space Credits reichen dafür nicht${missing != null ? ` (es fehlen ${(missing / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })})` : ''}. Erst aufladen.`, missing);
	}
	if (!res.ok) throw new Error(messages[answer?.code] ?? MESSAGES[answer?.code] ?? (answer?.error ? `Le Space Credits: ${answer.error}` : `Le Space Credits antwortet ${res.status}`));
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
	if (!ADDRESS.test(String(backupKey ?? ''))) throw new Error('Der Schlüssel der VM für die Sicherungen ist keine Adresse.');
	const r = await send(master, 'POST', '/v1/backup/authorize', { backupKey }, options, BACKUP_KEY_MESSAGES);
	if (!ADDRESS.test(String(r?.payer ?? '')) || !ADDRESS.test(String(r?.signer ?? ''))) throw new Error('Le Space Credits haben kein Konto für die Sicherungen genannt.');
	if (!/^[0-9a-f]{8,64}$/.test(String(r?.tag ?? ''))) throw new Error('Le Space Credits haben keine Kennung für die Sicherungen genannt.');
	if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(r?.label ?? ''))) throw new Error('Le Space Credits haben keinen Namen für die Datensätze genannt.');
	if (!NETWORKS.includes(r?.network)) throw new Error('Le Space Credits haben kein Netz für die Sicherungen genannt.');
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
	if (res.status === 412) throw new TermsError('Erst den aktuellen Bedingungen (AGB) zustimmen, dann geht es weiter.');
	if (res.status === 503) throw new Error('Bezahlen ist beim Credits-Dienst noch nicht eingerichtet.');
	if (!res.ok || typeof body?.client_secret !== 'string') throw new Error(body?.error ? `Le Space Credits: ${body.error}` : `Le Space Credits antwortet ${res.status}`);
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
	if (!/^0x[0-9a-fA-F]{40}$/.test(String(r?.owner ?? ''))) throw new Error('Le Space Credits haben kein Konto für die VM genannt.');
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
	if (!ADDRESS.test(String(backupKey ?? ''))) throw new Error('Der Schlüssel der VM für die Sicherungen ist keine Adresse.');
	const r = await send(master, 'DELETE', '/v1/backup/authorize', { backupKey }, options, BACKUP_KEY_MESSAGES);
	return { revoked: r?.revoked === true };
}

/**
 * Subscribe to a package with Stripe (card, monthly invoice): the service
 * answers a Checkout in subscription mode, mounted like a top-up on /pay.
 * @param {Uint8Array} master @param {string} packageId
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<string>} the client secret
 */
export async function startSubscription(master, packageId, options) {
	const r = await send(master, 'POST', '/v1/subscribe', { package: packageId, locale: 'de' }, options);
	if (typeof r?.client_secret !== 'string') throw new Error('Le Space Credits haben keine Bezahlseite für das Abo geliefert.');
	return r.client_secret;
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
	if (!url) throw new Error('Le Space Credits haben keine Stripe-Adresse geliefert.');
	return url;
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
