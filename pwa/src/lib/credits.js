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
	return { credits: Number(body?.credits ?? 0), reserved: Number(body?.reserved ?? 0), lines: body?.lines_this_month ?? {} };
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
