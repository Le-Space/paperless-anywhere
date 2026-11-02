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
