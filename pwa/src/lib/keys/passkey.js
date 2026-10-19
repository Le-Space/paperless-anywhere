// The passkey with the WebAuthn PRF extension: one fixed input per purpose,
// asked of this credential only (another passkey of this origin on the same
// authenticator must not answer), with user verification. No PRF, no unlock:
// there is deliberately no fallback without it.
import { sha256 } from '@noble/hashes/sha2.js';

const PRF_INPUT = sha256(new TextEncoder().encode('paperless-anywhere/prf/master/v1'));

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const unb64u = (text) => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));

export class PrfUnavailableError extends Error {
	constructor() {
		super('Dieser Passkey kann kein PRF; ohne PRF lässt sich nichts entsperren.');
		this.name = 'PrfUnavailableError';
	}
}

/** Create a passkey; returns its id (base64url). @param {string} name */
export async function createPasskey(name) {
	const credential = /** @type {PublicKeyCredential} */ (
		await navigator.credentials.create({
			publicKey: {
				rp: { name: 'Paperless anywhere' },
				user: { id: crypto.getRandomValues(new Uint8Array(16)), name, displayName: name },
				challenge: crypto.getRandomValues(new Uint8Array(32)),
				pubKeyCredParams: [
					{ type: 'public-key', alg: -7 },
					{ type: 'public-key', alg: -257 }
				],
				authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
				extensions: /** @type {any} */ ({ prf: {} })
			}
		})
	);
	const ext = /** @type {any} */ (credential.getClientExtensionResults());
	if (ext?.prf?.enabled === false) throw new PrfUnavailableError();
	return b64u(credential.rawId);
}

/**
 * The passkey's PRF answer for the master secret: one touch. With a credential
 * id, only that passkey may answer; without one (a device that has not seen
 * this vault yet), the person picks one of their passkeys.
 * @param {string} [credentialId]
 * @returns {Promise<{ prf: Uint8Array, credentialId: string }>}
 */
export async function readPrf(credentialId) {
	const assertion = /** @type {PublicKeyCredential} */ (
		await navigator.credentials.get({
			publicKey: {
				challenge: crypto.getRandomValues(new Uint8Array(32)),
				...(credentialId ? { allowCredentials: [{ type: 'public-key', id: unb64u(credentialId) }] } : {}),
				userVerification: 'required',
				extensions: /** @type {any} */ ({ prf: { eval: { first: PRF_INPUT } } })
			}
		})
	);
	const first = /** @type {any} */ (assertion.getClientExtensionResults())?.prf?.results?.first;
	if (!first || first.byteLength < 32) throw new PrfUnavailableError();
	return { prf: new Uint8Array(first), credentialId: b64u(assertion.rawId) };
}
