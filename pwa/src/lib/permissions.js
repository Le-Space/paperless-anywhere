// What the paying account grants this app, once, from MetaMask (or a hardware
// wallet in it): on Aleph, the right to send INSTANCE and FORGET messages, and
// the port-forwarding aggregate, on its behalf (measured: an INSTANCE by a delegate without credits is paid by
// the owner, and the delegate may forget it); on Filecoin, a session key that
// may create data sets and add pieces until it expires. Both are revocable.
import { createPublicClient, createWalletClient, custom, getAddress, http, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as SessionKey from '@filoz/synapse-core/session-key';
import { calibration, mainnet } from '@filoz/synapse-core/chains';
import { createUnsignedAggregateMessage, signAlephMessage } from '@le-space/core';
import { broadcast, readAggregate } from './aleph.js';
import { filecoinSessionPrivateKey } from './keys/derive.js';

export const PWA_TYPES = ['INSTANCE', 'FORGET', 'AGGREGATE'];
// AGGREGATE only for the payer's port forwards (443 for Caddy).
export const PWA_AGGREGATE_KEYS = ['port-forwarding'];
export const SESSION_PERMISSIONS = [SessionKey.CreateDataSetPermission, SessionKey.AddPiecesPermission];
export const filecoinChain = (network) => (network === 'mainnet' ? mainnet : calibration);

function ethereum() {
	const provider = /** @type {any} */ (globalThis).ethereum;
	if (!provider) throw new Error('Kein Wallet gefunden (MetaMask oder ein Hardware-Wallet in MetaMask).');
	return provider;
}

/** Connect the paying account; returns its address. */
export async function connectPayer() {
	const [address] = await ethereum().request({ method: 'eth_requestAccounts' });
	if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? '')) throw new Error('Das Wallet hat kein Konto freigegeben.');
	// Aleph keys balances and aggregates by the checksum spelling; MetaMask
	// answers in lowercase, under which the account has no credits.
	return getAddress(address);
}

async function sha256Hex(text) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The payer's Aleph authorizations (empty if none). */
export async function readAuthorizations(payer) {
	const security = await readAggregate(payer, 'security');
	return Array.isArray(security?.authorizations) ? security.authorizations : [];
}

/** Is `pwaAddress` allowed to send INSTANCE and FORGET for `payer`? */
export function isAuthorized(authorizations, pwaAddress) {
	const entry = authorizations.find((a) => a?.address?.toLowerCase() === pwaAddress.toLowerCase());
	if (!entry) return false;
	const typesOk = PWA_TYPES.every((t) => !entry.types || entry.types.includes(t));
	const keysOk = PWA_AGGREGATE_KEYS.every((k) => !entry.aggregate_keys || entry.aggregate_keys.includes(k));
	return typesOk && keysOk;
}

/**
 * Write the payer's security aggregate with this app's entry added (or, with
 * `revoke`, removed). Other authorizations are kept: Aleph replaces the whole list.
 */
export async function setAlephAuthorization(payer, pwaAddress, { revoke = false } = {}) {
	const others = (await readAuthorizations(payer)).filter((a) => a?.address?.toLowerCase() !== pwaAddress.toLowerCase());
	const authorizations = revoke ? others : [...others, { address: pwaAddress, types: PWA_TYPES, aggregate_keys: PWA_AGGREGATE_KEYS }];
	const unsigned = await createUnsignedAggregateMessage({
		sender: payer,
		content: /** @type {any} */ ({ address: payer, key: 'security', content: { authorizations }, time: Date.now() / 1000 }),
		hasher: sha256Hex
	});
	const message = await signAlephMessage(unsigned, (sender, payload) =>
		ethereum().request({ method: 'personal_sign', params: [toHex(payload), sender] })
	);
	const { httpStatus, response } = await broadcast(message);
	if (httpStatus >= 300) throw new Error(`Aleph hat die Freigabe abgelehnt (${httpStatus}): ${JSON.stringify(response).slice(0, 160)}`);
	return authorizations;
}

/** The session key's address for this vault. @param {Uint8Array} master */
export const sessionKeyAddress = (master) => privateKeyToAccount(filecoinSessionPrivateKey(master)).address;

/** Until when (seconds since 1970, 0 = never/expired) may the session key add pieces? */
export async function sessionKeyExpiry(payer, sessionAddress, network) {
	const client = createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 10_000 }) });
	return SessionKey.authorizationExpiry(client, { address: payer, sessionKeyAddress: sessionAddress, permission: SessionKey.AddPiecesPermission });
}

/** From the payer's wallet: authorize (or revoke) the session key for `days`. */
export async function setFilecoinSessionKey(payer, sessionAddress, network, { days = 30, revoke = false } = {}) {
	const chain = filecoinChain(network);
	const wallet = createWalletClient({ account: payer, chain, transport: custom(ethereum()) });
	try {
		await wallet.switchChain({ id: chain.id });
	} catch {
		await wallet.addChain({ chain });
		await wallet.switchChain({ id: chain.id });
	}
	if (revoke) return SessionKey.revokeSync(wallet, { address: sessionAddress, permissions: SESSION_PERMISSIONS });
	const expiresAt = BigInt(Math.floor(Date.now() / 1000 + days * 86400));
	await SessionKey.loginSync(wallet, { address: sessionAddress, permissions: SESSION_PERMISSIONS, expiresAt });
	return expiresAt;
}
