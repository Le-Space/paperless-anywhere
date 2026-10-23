// A page under /ipfs/… or /ipns/… is on a path-style gateway: the browser
// gives it the gateway's origin, which every other CID there shares – its
// storage and its passkeys. The vault opens only on an origin of its own: the
// domain, or a subdomain gateway (<cid>.ipfs.<host>), where the CID is the origin.

export const HOME = 'https://paperless.le-space.de/';

/** @param {string} [pathname] defaults to the page's */
export function sharedOrigin(pathname = globalThis.location?.pathname ?? '/') {
	return /^\/ip[fn]s\//.test(pathname);
}
